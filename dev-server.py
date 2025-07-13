#!/usr/bin/env python3
"""
Development server using FastAPI/Uvicorn with auto-reload
Works on both desktop and Android/Termux environments
"""

import os
import sys
import subprocess
import socket
import argparse
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import uvicorn

# Default configuration
DEFAULT_PORT = 8080

def get_local_ip():
    """Get local IP address for network access"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return None

def build_config():
    """Run build-config.sh if it exists"""
    if os.path.exists('build-config.sh'):
        print("🔨 Building configuration from .env file...")
        try:
            os.chmod('build-config.sh', 0o755)
            result = subprocess.run(['./build-config.sh'], check=True)
            print("✅ Configuration built successfully")
            return True
        except subprocess.CalledProcessError:
            print("❌ Configuration build failed")
            return False
    return True

def create_app():
    """Create FastAPI application"""
    app = FastAPI()
    
    # Redirect root to /forked/
    @app.get("/")
    async def redirect_root():
        return RedirectResponse(url="/forked/", status_code=301)
    
    # Mount static files at /forked
    app.mount("/forked", StaticFiles(directory=".", html=True), name="static")
    
    return app

def main():
    parser = argparse.ArgumentParser(description='Development server for Recipe App')
    parser.add_argument('port', nargs='?', type=int, default=DEFAULT_PORT,
                        help=f'Port to run server on (default: {DEFAULT_PORT})')
    parser.add_argument('--no-reload', action='store_true',
                        help='Disable auto-reload on file changes')
    
    args = parser.parse_args()
    
    # Build configuration first
    if not build_config():
        sys.exit(1)
    
    # Print startup message
    print("\n📱 Recipe App Development Server (FastAPI)")
    print("=" * 40)
    
    # Get local IP
    local_ip = get_local_ip()
    
    print(f"\n🌐 Access URLs:")
    print(f"  📍 Local:   http://localhost:{args.port}/forked/")
    if local_ip:
        print(f"  📱 Network: http://{local_ip}:{args.port}/forked/")
    print(f"\n⚠️  Note: Root path (/) redirects to /forked/")
    
    if not args.no_reload:
        print("\n👁️  Auto-reload enabled (watching for file changes)")
    else:
        print("\n⏸️  Auto-reload disabled")
    
    print("\n✨ Press Ctrl+C to stop the server")
    print("-" * 40 + "\n")
    
    # Run server
    try:
        uvicorn.run(
            "dev-server:create_app",
            host="0.0.0.0",
            port=args.port,
            reload=not args.no_reload,
            reload_dirs=["."],
            reload_includes=["*.js", "*.html", "*.css", "*.json", "*.md"],
            reload_excludes=["*.git*", "*node_modules*", "*__pycache__*"],
            factory=True,
            log_level="info",
            access_log=True
        )
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if "Address already in use" in str(e):
            print(f"   Port {args.port} is already in use")
        sys.exit(1)

if __name__ == '__main__':
    main()