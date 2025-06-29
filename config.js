// Configuration file for Recipe Box Google Drive integration
// This contains the OAuth client ID needed for Google Drive authentication

export const CONFIG = {
  google: {
    // Google OAuth 2.0 Client ID configured for GitHub Pages
    // Domain: https://rfishermonteith.github.io
    clientId: '207754197974-7vffe4ls3stf8im6et0ih79he8gjssfj.apps.googleusercontent.com',
    apiKey: 'your-api-key-here', // Optional, not currently used
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
export const GOOGLE_CLIENT_ID = CONFIG.google.clientId;
