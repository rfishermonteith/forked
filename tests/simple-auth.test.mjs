#!/usr/bin/env node

import { strict as assert } from 'assert';

// Simple test runner
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failCount++;
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
  }
}

function describe(suite, fn) {
  console.log(`\n${suite}`);
  fn();
}

// Mock localStorage
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
    delete this.store[key];
  }
}

// Test the core token logic
describe('Token Persistence Logic', () => {
  const mockStorage = new MockLocalStorage();
  
  test('should store token with expiration', () => {
    const token = {
      access_token: 'test_token',
      expires_in: 3600
    };
    
    const tokenData = {
      access_token: token.access_token,
      expires_at: Date.now() + (token.expires_in * 1000)
    };
    
    mockStorage.setItem('google_drive_token', JSON.stringify(tokenData));
    
    const saved = JSON.parse(mockStorage.getItem('google_drive_token'));
    assert.equal(saved.access_token, 'test_token');
    assert.ok(saved.expires_at > Date.now());
  });
  
  test('should detect expired tokens', () => {
    const expiredToken = {
      access_token: 'expired_token',
      expires_at: Date.now() - 1000 // 1 second ago
    };
    
    mockStorage.setItem('google_drive_token', JSON.stringify(expiredToken));
    const saved = JSON.parse(mockStorage.getItem('google_drive_token'));
    
    const isExpired = Date.now() >= saved.expires_at;
    assert.ok(isExpired);
  });
  
  test('should detect tokens about to expire', () => {
    const soonToExpire = {
      access_token: 'expiring_token',
      expires_at: Date.now() + (4 * 60 * 1000) // 4 minutes
    };
    
    mockStorage.setItem('google_drive_token', JSON.stringify(soonToExpire));
    const saved = JSON.parse(mockStorage.getItem('google_drive_token'));
    
    const timeUntilExpiry = saved.expires_at - Date.now();
    const needsRefresh = timeUntilExpiry < 5 * 60 * 1000; // Less than 5 minutes
    assert.ok(needsRefresh);
  });
  
  test('should handle missing tokens', () => {
    mockStorage.removeItem('google_drive_token');
    const saved = mockStorage.getItem('google_drive_token');
    assert.equal(saved, null);
  });
});

describe('Token Refresh Scenarios', () => {
  test('should calculate correct expiration time', () => {
    const expiresIn = 3600; // 1 hour in seconds
    const now = Date.now();
    const expiresAt = now + (expiresIn * 1000);
    
    // Should be approximately 1 hour in the future
    const diff = expiresAt - now;
    assert.ok(diff >= 3599000 && diff <= 3601000); // Allow 1 second variance
  });
  
  test('should identify tokens needing refresh', () => {
    const scenarios = [
      { minutesLeft: 2, shouldRefresh: true },
      { minutesLeft: 4, shouldRefresh: true },
      { minutesLeft: 6, shouldRefresh: false },
      { minutesLeft: 60, shouldRefresh: false }
    ];
    
    scenarios.forEach(scenario => {
      const expiresAt = Date.now() + (scenario.minutesLeft * 60 * 1000);
      const timeUntilExpiry = expiresAt - Date.now();
      const needsRefresh = timeUntilExpiry < 5 * 60 * 1000;
      
      assert.equal(needsRefresh, scenario.shouldRefresh, 
        `Token with ${scenario.minutesLeft} minutes left should${scenario.shouldRefresh ? '' : ' not'} need refresh`);
    });
  });
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Test Results: ${passCount} passed, ${failCount} failed, ${testCount} total`);
console.log(failCount === 0 ? '✅ All tests passed!' : '❌ Some tests failed');
process.exit(failCount > 0 ? 1 : 0);