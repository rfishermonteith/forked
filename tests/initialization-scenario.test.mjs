#!/usr/bin/env node

import { strict as assert } from 'assert';

/**
 * App Initialization Scenario Test
 * 
 * This test simulates the FULL app startup flow that real users experience:
 * 1. User returns to app after 1+ hours
 * 2. App initializes sync manager  
 * 3. Sync manager initializes GoogleDriveProvider
 * 4. Provider.init() tries to restore saved token
 * 5. App checks isAuthenticated() status
 * 
 * This is DIFFERENT from the API call test - this tests the initialization path
 * that was causing the real-world bug where tokens were deleted before refresh.
 */

console.log('App Initialization Test - Full Startup Flow\n');

// Mock Google APIs
let currentToken = null;
let tokenRefreshAttempted = false;
let tokenRemovedFromStorage = false;

const mockGapi = {
  load: (api, callback) => callback(),
  client: {
    init: async () => {},
    getToken: () => currentToken,
    setToken: (token) => { currentToken = token; },
    drive: {
      about: {
        get: async () => {
          if (currentToken && currentToken.expires_at < Date.now()) {
            const error = new Error('Invalid token');
            error.status = 401;
            throw error;
          }
          return { result: { user: {} } };
        }
      }
    }
  }
};

const mockGoogle = {
  accounts: {
    oauth2: {
      initTokenClient: () => ({
        requestAccessToken: (options) => {
          tokenRefreshAttempted = true;
          setTimeout(() => {
            if (mockTokenClient.callback) {
              currentToken = {
                access_token: 'refreshed_token',
                expires_at: Date.now() + 3600000
              };
              mockTokenClient.callback({
                access_token: 'refreshed_token',
                expires_in: 3600
              });
            }
          }, 10);
        },
        callback: null
      })
    }
  }
};

let mockTokenClient;

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = value;
  }
  removeItem(key) {
    tokenRemovedFromStorage = true;
    console.log('💥 TEST: Token was removed from storage!');
    delete this.store[key];
  }
}

async function testFullInitializationFlow() {
  console.log('Testing: Full app initialization with expired token\n');

  try {
    // Import the real GoogleDriveProvider
    const { GoogleDriveProvider } = await import('../google-drive-provider.js');
    
    // Set up global mocks
    global.gapi = mockGapi;
    global.google = mockGoogle;
    global.document = {
      head: { 
        appendChild: (element) => {
          // Simulate script loading
          if (element.tagName === 'SCRIPT') {
            setTimeout(() => {
              if (element.onload) element.onload();
            }, 0);
          }
          return element;
        }
      },
      querySelector: () => null,
      createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        onload: null,
        onerror: null,
        src: ''
      })
    };
    
    // Create mock localStorage with expired token (simulating user returning after 1+ hours)
    const mockStorage = new MockLocalStorage();
    const expiredTokenData = {
      access_token: 'expired_token_from_yesterday',
      expires_at: Date.now() - (2 * 60 * 60 * 1000) // Expired 2 hours ago
    };
    mockStorage.setItem('google_drive_token', JSON.stringify(expiredTokenData));
    global.localStorage = mockStorage;
    global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    
    console.log('1. 💾 Setup: Expired token in localStorage (2 hours old)');
    console.log('2. 🚀 Starting app initialization...\n');
    
    // STEP 1: Create provider (like app does)
    const provider = new GoogleDriveProvider({ clientId: 'test-client' });
    
    // STEP 2: Initialize provider (like SyncManager.initProvider does)
    console.log('📱 Calling provider.init() (like real app does)...');
    await provider.init();
    
    // Override tokenClient for testing
    if (provider.tokenClient) {
      provider.tokenClient.requestAccessToken = (options) => {
        tokenRefreshAttempted = true;
        setTimeout(() => {
          if (provider.tokenClient.callback) {
            currentToken = {
              access_token: 'refreshed_token',
              expires_at: Date.now() + 3600000
            };
            provider.tokenClient.callback({
              access_token: 'refreshed_token',
              expires_in: 3600
            });
          }
        }, 10);
      };
    }
    
    // STEP 3: Check authentication status (like app does)
    console.log('📱 Calling provider.checkAuth() (like real app does)...');
    const isAuth = await provider.checkAuth();
    
    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('\n🔍 RESULTS:');
    console.log(`   - Token refresh attempted: ${tokenRefreshAttempted}`);
    console.log(`   - Token removed from storage: ${tokenRemovedFromStorage}`);
    console.log(`   - Final auth status: ${isAuth}`);
    
    // THE TEST: Token should NOT be removed during init, and refresh should be attempted
    if (tokenRemovedFromStorage && !tokenRefreshAttempted) {
      console.log('\n❌ FAIL: Token was removed before refresh was attempted!');
      console.log('   This is the bug that caused "needs to reconnect" issue.');
      process.exit(1);
    } else if (tokenRefreshAttempted && isAuth) {
      console.log('\n✅ PASS: Token refresh was attempted and succeeded!');
      console.log('   App should show connected state and work seamlessly.');
      process.exit(0);
    } else if (tokenRefreshAttempted && !isAuth) {
      console.log('\n✅ PASS: Token refresh was attempted but failed.');
      console.log('   This is expected if Google denies silent refresh.');
      console.log('   App should gracefully show "needs to reconnect".');
      process.exit(0);
    } else {
      console.log('\n❓ UNEXPECTED: Neither refresh attempted nor token removed.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 ERROR:', error.message);
    process.exit(1);
  }
}

testFullInitializationFlow();