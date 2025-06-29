#!/bin/bash

# Test Auto-Reconnect Feature
echo "Testing Google Drive Auto-Reconnect Feature"
echo "=========================================="
echo ""
echo "This test will help verify that the auto-reconnect feature works correctly."
echo ""
echo "Test Steps:"
echo "1. First, open the main app and connect to Google Drive"
echo "2. Select a recipe folder and perform a sync"
echo "3. Close the browser tab/window"
echo "4. Re-open the app - it should automatically:"
echo "   - Detect the saved authentication"
echo "   - Restore the folder selection"
echo "   - Perform an automatic sync"
echo ""
echo "Opening test page to check token storage..."
echo ""

# Start test server if not running
if ! lsof -i:8001 > /dev/null 2>&1; then
    echo "Starting test server on port 8001..."
    python3 -m http.server 8001 &
    SERVER_PID=$!
    sleep 2
fi

# Open test page
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:8001/test-auto-reconnect.html"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:8001/test-auto-reconnect.html"
else
    echo "Please open: http://localhost:8001/test-auto-reconnect.html"
fi

echo ""
echo "Test page opened. Use the buttons to:"
echo "- Check stored tokens"
echo "- Clear tokens for fresh testing"
echo "- Simulate expired tokens"
echo ""
echo "Press Ctrl+C to stop the test server."

# Keep script running
wait