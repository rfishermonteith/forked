import http.server
import socketserver
import os
import urllib.parse

PORT = 8080

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
    
    def translate_path(self, path):
        return super().translate_path(path)
    
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
        # Cleaner logging
        print(f"{self.address_string()} - {format%args}")

print(f"\n🚀 Server starting on port {PORT}...")
print(f"📱 Access ONLY at: http://localhost:{PORT}/forked/")
print(f"   Note: Root path (/) redirects to /forked/ to match GitHub Pages")
print(f"   ⚠️  Direct access to localhost:{PORT} will redirect to /forked/")

with socketserver.TCPServer(("", PORT), PWAHandler) as httpd:
    httpd.serve_forever()
