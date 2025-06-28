#!/bin/bash
# Build configuration from .env file

echo "📦 Building configuration from .env..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Copy .env.example to .env and fill in your values:"
    echo "   cp .env.example .env"
    exit 1
fi

# Source the .env file
set -a  # automatically export all variables
source .env
set +a

# Validate required variables
if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "❌ GOOGLE_CLIENT_ID is required in .env"
    exit 1
fi

# Generate config.js file
cat > config.js << EOF
// Auto-generated configuration file
// DO NOT EDIT - Generated from .env by build-config.sh

export const CONFIG = {
  google: {
    clientId: '$GOOGLE_CLIENT_ID',
    apiKey: '${GOOGLE_API_KEY:-}',
  },
  // Add other service configs here in future
  dropbox: {
    // Will be added when implementing Dropbox provider
  },
  onedrive: {
    // Will be added when implementing OneDrive provider
  }
};

// For backwards compatibility
export const GOOGLE_CLIENT_ID = '$GOOGLE_CLIENT_ID';
EOF

echo "✅ Configuration built successfully!"
echo "   Generated: config.js"
echo "   Google Client ID: ${GOOGLE_CLIENT_ID:0:20}..."