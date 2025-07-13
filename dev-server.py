#!/usr/bin/env python3
"""
Development server with file watching for Recipe App
Works on both desktop and Android/Termux environments
No external dependencies required - uses Python stdlib only
"""

import http.server
import socketserver
import os
import sys
import subprocess
import socket
import argparse
import time
import threading
from pathlib import Path

# Default configuration
DEFAULT_PORT = 8080
WATCH_EXTENSIONS = {'.js', '.html', '.css', '.json', '.md'}
WATCH_DIRS = ['.']
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.idea', '.vscode', '.uv'}

class PWAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Redirect root requests to /forked/
        if self.path == '/' or self.path == '':
            self.send_response(301)
            self.send_header('Location', '/forked/')
            self.end_headers()
            return
        
        # Handle /forked requests
        if self.path.startswith('/forked/'):
            # Remove /forked prefix and serve the file
            self.path = self.path[7:]  # Remove '/forked'
            if self.path == '':
                self.path = '/'
        elif self.path == '/forked':
            self.path = '/'
        else:
            # Anything else should 404
            self.send_error(404, "Only /forked/ path is served")
            return
            
        return super().do_GET()
    
    def end_headers(self):
        self.send_header('Service-Worker-Allowed', '/')
        # Aggressive cache prevention for development
        if self.path.endswith(('.js', '.html', '.css')):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Cleaner logging with timestamp
        timestamp = time.strftime('%H:%M:%S')
        print(f"[{timestamp}] {self.address_string()} - {format%args}")

class FileWatcher:
    """Simple file watcher using polling"""
    def __init__(self, callback, extensions=WATCH_EXTENSIONS, dirs=WATCH_DIRS):
        self.callback = callback
        self.extensions = extensions
        self.dirs = dirs
        self.file_times = {}
        self.running = False
        
    def get_files(self):
        """Get all files to watch"""
        files = []
        for watch_dir in self.dirs:
            for root, dirs, filenames in os.walk(watch_dir):
                # Skip ignored directories
                dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
                
                for filename in filenames:
                    if any(filename.endswith(ext) for ext in self.extensions):
                        filepath = os.path.join(root, filename)
                        files.append(filepath)
        return files
    
    def check_changes(self):
        """Check if any watched files have changed"""
        changed = False
        current_files = self.get_files()
        current_times = {}
        
        for filepath in current_files:
            try:
                mtime = os.path.getmtime(filepath)
                current_times[filepath] = mtime
                
                if filepath not in self.file_times:
                    # New file
                    changed = True
                elif self.file_times[filepath] != mtime:
                    # Modified file
                    print(f"\n🔄 File changed: {filepath}")
                    changed = True
            except OSError:
                # File might have been deleted
                pass
        
        # Check for deleted files
        for filepath in self.file_times:
            if filepath not in current_times:
                print(f"\n🗑️  File deleted: {filepath}")
                changed = True
        
        self.file_times = current_times
        return changed
    
    def run(self):
        """Run the file watcher"""
        self.running = True
        # Initial scan
        self.check_changes()
        
        print("\n👁️  Watching for file changes...")
        print(f"   Extensions: {', '.join(self.extensions)}")
        
        while self.running:
            time.sleep(1)  # Check every second
            if self.check_changes():
                self.callback()
    
    def stop(self):
        """Stop the file watcher"""
        self.running = False

def get_local_ip():
    """Get local IP address for network access"""
    try:
        # Try using socket method first (more reliable)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        # Fallback to parsing network interfaces
        try:
            # Try ip command (works on Linux/Android)
            result = subprocess.run(['ip', '-4', 'addr', 'show'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'inet' in line and '127.0.0.1' not in line:
                        ip = line.split()[1].split('/')[0]
                        return ip
        except:
            pass
            
        try:
            # Try ifconfig (older systems)
            result = subprocess.run(['ifconfig'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                import re
                matches = re.findall(r'inet (?:addr:)?(\d+\.\d+\.\d+\.\d+)', result.stdout)
                for ip in matches:
                    if ip != '127.0.0.1':
                        return ip
        except:
            pass
    return None

def build_config():
    """Run build-config.sh if it exists"""
    if os.path.exists('build-config.sh'):
        print("🔨 Building configuration from .env file...")
        try:
            # Make sure it's executable
            os.chmod('build-config.sh', 0o755)
            result = subprocess.run(['./build-config.sh'], check=True)
            print("✅ Configuration built successfully")
            return True
        except subprocess.CalledProcessError:
            print("❌ Configuration build failed")
            return False
    return True

def run_server(port, no_watch=False):
    """Run the development server"""
    # Build configuration first
    if not build_config():
        sys.exit(1)
    
    # Allow socket reuse
    socketserver.TCPServer.allow_reuse_address = True
    
    # Server setup
    httpd = None
    watcher = None
    restart_requested = False
    
    def restart_server():
        nonlocal restart_requested
        restart_requested = True
        if httpd:
            print("\n🔄 Restarting server...")
            httpd.shutdown()
    
    def signal_handler(sig, frame):
        print("\n\n👋 Shutting down...")
        if watcher:
            watcher.stop()
        if httpd:
            httpd.shutdown()
        sys.exit(0)
    
    # Set up signal handler for clean shutdown
    try:
        import signal
        signal.signal(signal.SIGINT, signal_handler)
    except:
        # Signal handling might not work on all platforms
        pass
    
    while True:
        restart_requested = False
        
        # Print startup message
        print("\n📱 Recipe App Development Server")
        print("=" * 40)
        
        # Get local IP
        local_ip = get_local_ip()
        
        print(f"\n🚀 Server starting on port {port}...")
        print(f"\n🌐 Access URLs:")
        print(f"  📍 Local:   http://localhost:{port}/forked/")
        if local_ip:
            print(f"  📱 Network: http://{local_ip}:{port}/forked/")
        print(f"\n⚠️  Note: Root path (/) redirects to /forked/")
        
        # Start file watcher in a separate thread if enabled
        if not no_watch:
            watcher = FileWatcher(restart_server)
            watcher_thread = threading.Thread(target=watcher.run, daemon=True)
            watcher_thread.start()
        else:
            print("\n⏸️  File watching disabled")
        
        print("\n✨ Press Ctrl+C to stop the server")
        print("-" * 40)
        
        # Start server
        try:
            httpd = socketserver.TCPServer(("", port), PWAHandler)
            server_thread = threading.Thread(target=httpd.serve_forever)
            server_thread.start()
            
            # Wait for shutdown signal
            while not restart_requested:
                time.sleep(0.5)
            
            httpd.shutdown()
            server_thread.join()
            
            if watcher:
                watcher.stop()
            
            # If we're here, a restart was requested
            print("\n♻️  Restarting in 1 second...")
            time.sleep(1)
            
        except OSError as e:
            print(f"\n❌ Error: {e}")
            if "Address already in use" in str(e):
                print(f"   Port {port} might already be in use")
            sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Development server for Recipe App')
    parser.add_argument('port', nargs='?', type=int, default=DEFAULT_PORT,
                        help=f'Port to run server on (default: {DEFAULT_PORT})')
    parser.add_argument('--no-watch', action='store_true',
                        help='Disable file watching and auto-restart')
    
    args = parser.parse_args()
    
    # Check Python version
    if sys.version_info < (3, 6):
        print("❌ Python 3.6+ required")
        sys.exit(1)
    
    run_server(args.port, args.no_watch)

if __name__ == '__main__':
    main()