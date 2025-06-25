#!/bin/bash
# Mobile testing script for Termux/Android
# Run: bash test-mobile.sh

echo "📱 Recipe App Mobile Test Server"
echo "================================"

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "Python not found. Installing..."
    pkg install python -y
fi

# Get the local IP address (works on Termux)
if command -v ifconfig &> /dev/null; then
    LOCAL_IP=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
else
    LOCAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n1)
fi

PORT=8080

# Create simple Python server
cat > server.py << 'EOF'
import http.server
import socketserver
import os
import urllib.parse

PORT = 8080

class PWAHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Remove /forked prefix if present
        if path.startswith('/forked/'):
            path = path[7:]  # Remove '/forked'
        elif path == '/forked':
            path = '/'
        return super().translate_path(path)
    
    def end_headers(self):
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def log_message(self, format, *args):
        # Cleaner logging
        print(f"{self.address_string()} - {format%args}")

print(f"\n🚀 Server starting on port {PORT}...")
print(f"📱 Access on this device: http://localhost:{PORT}/forked/")
print(f"   Note: The app is served at /forked/ to match GitHub Pages")

with socketserver.TCPServer(("", PORT), PWAHandler) as httpd:
    httpd.serve_forever()
EOF

echo ""
echo "🌐 Access URLs:"
echo "  - On this device: http://localhost:$PORT/forked/"
if [ ! -z "$LOCAL_IP" ]; then
    echo "  - On same WiFi:  http://$LOCAL_IP:$PORT/forked/"
fi
echo ""
echo "📝 PWA Testing Tips:"
echo "  - Open in Chrome/Firefox on Android"
echo "  - Look for 'Install' option in browser menu"
echo "  - Test offline mode in airplane mode"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
python server.py

# Cleanup
rm server.py