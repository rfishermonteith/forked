import { CloudStorageProvider } from './cloud-storage-interface.js';
import { CONFIG } from './config.js';

/**
 * Google Drive implementation of CloudStorageProvider
 */
export class GoogleDriveProvider extends CloudStorageProvider {
  constructor(config = {}) {
    super(config);
    this.clientId = config.clientId || CONFIG.google.clientId;
    this.scopes = 'https://www.googleapis.com/auth/drive';
    this.discoveryDoc = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    this.tokenClient = null;
    this.recipeFolderId = null;
    this.lastSync = null;
  }

  async init() {
    // Load Google Identity Services (modern approach)
    await this.loadScript('https://accounts.google.com/gsi/client');
    
    // Load Google API client for Drive API calls
    await this.loadScript('https://apis.google.com/js/api.js');
    await new Promise((resolve) => gapi.load('client', resolve));
    
    // Initialize Google API client for Drive API
    await gapi.client.init({
      discoveryDocs: [this.discoveryDoc],
    });

    // Initialize modern OAuth 2.0 token client
    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: this.scopes,
      callback: '', // Will be set in authenticate()
      error_callback: (error) => {
        console.error('OAuth error:', error);
      },
    });

    // Try to restore saved token
    const savedToken = this.getSavedToken();
    if (savedToken) {
      console.log('🔐 GoogleDrive: Found saved token in localStorage');
      
      if (savedToken.expires_at) {
        const now = Date.now();
        const expiresAt = new Date(savedToken.expires_at);
        const timeUntilExpiry = savedToken.expires_at - now;
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / (60 * 1000));
        
        console.log(`🔐 GoogleDrive: Token expires at ${expiresAt.toLocaleString()}`);
        console.log(`🔐 GoogleDrive: Time until expiry: ${minutesUntilExpiry} minutes`);
        
        if (timeUntilExpiry <= 0) {
          console.log('🔐 GoogleDrive: ❌ Token is EXPIRED - will need refresh');
          this.isAuthenticated = false;
        } else if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('🔐 GoogleDrive: ⚠️  Token expires soon - will auto-refresh on first API call');
          this.isAuthenticated = true;
        } else {
          console.log('🔐 GoogleDrive: ✅ Token is valid and fresh');
          this.isAuthenticated = true;
        }
      } else {
        console.log('🔐 GoogleDrive: ⚠️  Token has no expiration time - assuming valid');
        this.isAuthenticated = true;
      }
      
      gapi.client.setToken(savedToken);
      console.log(`🔐 GoogleDrive: Set initial auth state: ${this.isAuthenticated ? 'AUTHENTICATED' : 'NOT AUTHENTICATED'}`);
    } else {
      console.log('🔐 GoogleDrive: No saved token found - user needs to authenticate');
      this.isAuthenticated = false;
    }
  }

  async checkAuth() {
    console.log('🔍 GoogleDrive: checkAuth() called');
    const token = gapi.client.getToken();
    if (!token) {
      console.log('🔍 GoogleDrive: No token in gapi.client');
      return false;
    }
    
    // Check if token is about to expire (within 5 minutes)
    const savedToken = this.getSavedToken();
    if (savedToken && savedToken.expires_at) {
      const timeUntilExpiry = savedToken.expires_at - Date.now();
      const minutesLeft = Math.floor(timeUntilExpiry / (60 * 1000));
      
      if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
        console.log(`🔍 GoogleDrive: Token expires in ${minutesLeft} minutes - attempting silent refresh...`);
        return await this.silentRefresh();
      } else {
        console.log(`🔍 GoogleDrive: Token is fresh (${minutesLeft} minutes left) - skipping validation`);
        return true;
      }
    }
    
    // Verify token is still valid by making a test API call
    console.log('🔍 GoogleDrive: Validating token with Google API...');
    try {
      await gapi.client.drive.about.get({ fields: 'user' });
      console.log('🔍 GoogleDrive: ✅ Token validation successful');
      return true;
    } catch (error) {
      console.log('🔍 GoogleDrive: ❌ Token validation failed:', error.message);
      // Try silent refresh before giving up
      console.log('🔍 GoogleDrive: Attempting silent refresh as fallback...');
      const refreshed = await this.silentRefresh();
      if (refreshed) {
        console.log('🔍 GoogleDrive: ✅ Silent refresh successful');
        return true;
      }
      // Clear invalid token
      console.log('🔍 GoogleDrive: ❌ Silent refresh failed - clearing token');
      gapi.client.setToken('');
      this.clearSavedToken();
      return false;
    }
  }

  async silentRefresh() {
    console.log('🔄 GoogleDrive: Starting silent refresh...');
    return new Promise((resolve) => {
      this.tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
          console.error('🔄 GoogleDrive: ❌ Silent refresh failed:', resp.error);
          console.log('🔄 GoogleDrive: This means Google requires user re-authentication');
          resolve(false);
          return;
        }
        
        console.log('🔄 GoogleDrive: ✅ Silent refresh successful');
        console.log('🔄 GoogleDrive: New token received from Google');
        this.isAuthenticated = true;
        this.saveToken(resp);
        
        // Log the new expiration time
        const newToken = this.getSavedToken();
        if (newToken?.expires_at) {
          const expiresAt = new Date(newToken.expires_at);
          console.log(`🔄 GoogleDrive: New token expires at ${expiresAt.toLocaleString()}`);
        }
        
        resolve(true);
      };
      
      // Attempt to get a new token without user interaction
      console.log('🔄 GoogleDrive: Requesting new token from Google (silent)...');
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Wrapper for API calls that handles token refresh automatically
   */
  async withTokenRefresh(apiCall) {
    console.log('🔁 GoogleDrive: API call with automatic token refresh');
    try {
      // First check if token is about to expire
      const authValid = await this.checkAuth();
      if (!authValid) {
        console.log('🔁 GoogleDrive: ❌ Authentication check failed');
        throw new Error('Authentication required');
      }
      
      console.log('🔁 GoogleDrive: ✅ Authentication valid - making API call');
      // Make the API call
      return await apiCall();
    } catch (error) {
      // If we get a 401 error, try to refresh the token once
      if (error.status === 401 && !error._retried) {
        console.log('🔁 GoogleDrive: ❌ API call failed with 401 - attempting token refresh...');
        const refreshed = await this.silentRefresh();
        if (refreshed) {
          console.log('🔁 GoogleDrive: ✅ Token refreshed - retrying API call');
          // Mark that we've retried to avoid infinite loops
          error._retried = true;
          // Retry the API call
          return await apiCall();
        } else {
          console.log('🔁 GoogleDrive: ❌ Token refresh failed - API call cannot proceed');
        }
      }
      throw error;
    }
  }

  async authenticate() {
    return new Promise((resolve) => {
      this.tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
          console.error('Authentication error:', resp.error);
          resolve({ success: false, error: resp.error });
          return;
        }
        
        console.log('Authentication successful');
        this.isAuthenticated = true;
        
        // Save the token for persistence
        this.saveToken(resp);
        
        resolve({ success: true });
      };
      
      // Check if we already have a valid token
      const existingToken = gapi.client.getToken();
      if (existingToken === null) {
        // First time authentication - request with consent
        // Note: For a pure client-side app, we cannot use refresh tokens
        // The best we can do is prompt for re-authentication when needed
        this.tokenClient.requestAccessToken({ 
          prompt: 'consent',
          hint: 'Select or create the account you want to use for Recipe Box'
        });
      } else {
        // Try to refresh/reuse existing token
        this.tokenClient.requestAccessToken({ prompt: '' });
      }
    });
  }

  async signOut() {
    const token = gapi.client.getToken();
    if (token !== null) {
      // Revoke the token using modern GIS
      google.accounts.oauth2.revoke(token.access_token, () => {
        console.log('Access token revoked');
      });
      
      // Clear the token from the client
      gapi.client.setToken('');
      this.isAuthenticated = false;
      
      // Clear saved token
      this.clearSavedToken();
      
      console.log('User signed out successfully');
    }
  }

  async listRecipes() {
    if (!this.recipeFolderId) {
      throw new Error('No recipe folder selected. Please select a folder first.');
    }
    
    return this.withTokenRefresh(async () => {
      const response = await gapi.client.drive.files.list({
        q: `'${this.recipeFolderId}' in parents and name contains '.md' and trashed=false`,
        fields: 'files(id, name, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });

      return response.result.files.map(file => ({
        id: file.id,
        name: file.name,
        lastModified: new Date(file.modifiedTime),
        size: parseInt(file.size || 0)
      }));
    });
  }

  /**
   * List image files in the recipe folder
   */
  async listImages() {
    if (!this.recipeFolderId) {
      throw new Error('No recipe folder selected. Please select a folder first.');
    }
    
    const response = await gapi.client.drive.files.list({
      q: `'${this.recipeFolderId}' in parents and (name contains '.jpg' or name contains '.jpeg' or name contains '.png' or name contains '.webp') and trashed=false`,
      fields: 'files(id, name, modifiedTime, size)',
      orderBy: 'modifiedTime desc'
    });

    return response.result.files.map(file => ({
      id: file.id,
      name: file.name,
      lastModified: new Date(file.modifiedTime),
      size: parseInt(file.size || 0)
    }));
  }

  /**
   * Search for a specific folder by name
   */
  async findFolderByName(name) {
    const response = await gapi.client.drive.files.list({
      q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, owners, shared, capabilities)'
    });
    
    if (response.result.files.length > 0) {
      const folder = response.result.files[0];
      return {
        id: folder.id,
        name: folder.name,
        isShared: folder.shared || false,
        isOwned: folder.owners && folder.owners.some(owner => owner.me),
        canEdit: folder.capabilities && folder.capabilities.canEdit
      };
    }
    return null;
  }

  /**
   * Verify a specific folder exists and is accessible
   */
  async verifyFolder(folderId) {
    try {
      const response = await gapi.client.drive.files.get({
        fileId: folderId,
        fields: 'id, name, owners, shared, capabilities'
      });
      
      const folder = response.result;
      return {
        id: folder.id,
        name: folder.name,
        isShared: folder.shared || false,
        isOwned: folder.owners && folder.owners.some(owner => owner.me),
        canEdit: folder.capabilities && folder.capabilities.canEdit
      };
    } catch (error) {
      console.log('Folder verification failed:', error);
      return null;
    }
  }

  /**
   * List available folders using hybrid approach:
   * 1. Check for previously selected folder
   * 2. Search for "RecipeBox" folder
   * 3. Show simplified folder list or creation options
   */
  async listAvailableFolders() {
    const folders = [];
    
    // 1. Check for previously selected folder
    const savedFolderId = localStorage.getItem('selectedRecipeFolderId');
    if (savedFolderId) {
      const previousFolder = await this.verifyFolder(savedFolderId);
      if (previousFolder) {
        folders.push({ ...previousFolder, isPrevious: true });
      } else {
        // Clean up invalid saved folder ID
        localStorage.removeItem('selectedRecipeFolderId');
      }
    }
    
    // 2. Search for RecipeBox folder (if not already found as previous)
    const recipeBoxFolder = await this.findFolderByName('RecipeBox');
    if (recipeBoxFolder && !folders.find(f => f.id === recipeBoxFolder.id)) {
      folders.push({ ...recipeBoxFolder, isRecipeBox: true });
    }
    
    // 3. If we found folders, return them for immediate selection
    // Otherwise, return empty array to trigger folder creation/selection UI
    return folders;
  }

  /**
   * Set the active recipe folder
   */
  async selectFolder(folderId) {
    this.recipeFolderId = folderId;
    // Store the selected folder for future use
    await this.storeFolderSelection(folderId);
  }

  /**
   * Create a new recipe folder
   */
  async createRecipeFolder(name = 'RecipeBox') {
    const folderResponse = await gapi.client.drive.files.create({
      resource: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    
    const folderId = folderResponse.result.id;
    await this.selectFolder(folderId);
    return folderId;
  }

  /**
   * Share a folder with another user
   */
  async shareFolder(folderId, email, role = 'writer') {
    try {
      const response = await gapi.client.drive.permissions.create({
        fileId: folderId,
        resource: {
          role: role,
          type: 'user',
          emailAddress: email
        },
        sendNotificationEmail: true
      });
      return { success: true, permissionId: response.result.id };
    } catch (error) {
      console.error('Error sharing folder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Store folder selection in local storage
   */
  async storeFolderSelection(folderId) {
    // We'll use a simple localStorage approach for now
    // In a more complex app, this might go in IndexedDB
    localStorage.setItem('selectedRecipeFolderId', folderId);
  }

  /**
   * Restore previously selected folder
   */
  async restoreFolderSelection() {
    const folderId = localStorage.getItem('selectedRecipeFolderId');
    if (folderId) {
      // Verify the folder still exists and is accessible
      try {
        await gapi.client.drive.files.get({ fileId: folderId });
        this.recipeFolderId = folderId;
        return folderId;
      } catch (error) {
        console.log('Previously selected folder no longer accessible:', error);
        localStorage.removeItem('selectedRecipeFolderId');
        return null;
      }
    }
    return null;
  }

  async getRecipe(id) {
    // Get metadata
    const metaResponse = await gapi.client.drive.files.get({
      fileId: id,
      fields: 'name, modifiedTime'
    });

    // Get content
    const contentResponse = await gapi.client.drive.files.get({
      fileId: id,
      alt: 'media'
    });

    return {
      id: id,
      name: metaResponse.result.name,
      content: contentResponse.body,
      lastModified: new Date(metaResponse.result.modifiedTime)
    };
  }

  /**
   * Get image file as data URL
   */
  async getImage(id) {
    // Get metadata
    const metaResponse = await gapi.client.drive.files.get({
      fileId: id,
      fields: 'name, modifiedTime, mimeType'
    });

    // Get binary content
    const token = gapi.client.getToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      {
        headers: { 'Authorization': `Bearer ${token.access_token}` }
      }
    );

    const blob = await response.blob();
    const reader = new FileReader();
    
    return new Promise((resolve) => {
      reader.onloadend = () => {
        resolve({
          id: id,
          name: metaResponse.result.name,
          dataUrl: reader.result,
          mimeType: metaResponse.result.mimeType,
          lastModified: new Date(metaResponse.result.modifiedTime)
        });
      };
      reader.readAsDataURL(blob);
    });
  }

  async saveRecipe(name, content) {
    await this.ensureRecipeFolder();

    // Check if file exists
    const existing = await gapi.client.drive.files.list({
      q: `'${this.recipeFolderId}' in parents and name='${name}' and trashed=false`,
      fields: 'files(id)'
    });

    const metadata = {
      name: name,
      parents: existing.result.files.length === 0 ? [this.recipeFolderId] : undefined
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'text/markdown' }));

    let response;
    const token = gapi.client.getToken();
    
    if (existing.result.files.length > 0) {
      // Update existing
      const fileId = existing.result.files[0].id;
      response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token.access_token}` },
          body: form
        }
      );
    } else {
      // Create new
      response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token.access_token}` },
          body: form
        }
      );
    }

    const result = await response.json();
    this.lastSync = new Date();
    return { id: result.id, success: response.ok };
  }

  /**
   * Save image file to Google Drive
   */
  async saveImage(name, dataUrl) {
    await this.ensureRecipeFolder();

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Check if file exists
    const existing = await gapi.client.drive.files.list({
      q: `'${this.recipeFolderId}' in parents and name='${name}' and trashed=false`,
      fields: 'files(id)'
    });

    const metadata = {
      name: name,
      parents: existing.result.files.length === 0 ? [this.recipeFolderId] : undefined
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    let uploadResponse;
    const token = gapi.client.getToken();
    
    if (existing.result.files.length > 0) {
      // Update existing
      const fileId = existing.result.files[0].id;
      uploadResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token.access_token}` },
          body: form
        }
      );
    } else {
      // Create new
      uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token.access_token}` },
          body: form
        }
      );
    }

    const result = await uploadResponse.json();
    this.lastSync = new Date();
    return { id: result.id, success: uploadResponse.ok };
  }

  async deleteRecipe(id) {
    try {
      await gapi.client.drive.files.delete({ fileId: id });
      return { success: true };
    } catch (error) {
      console.error('Delete failed:', error);
      return { success: false };
    }
  }

  async getSyncStatus() {
    return {
      isOnline: navigator.onLine && this.isAuthenticated,
      lastSync: this.lastSync,
      pendingChanges: 0 // Would need to track this in real implementation
    };
  }

  getInfo() {
    return {
      name: 'Google Drive',
      icon: '🔷', // Could use actual Google Drive icon
      description: 'Sync recipes with your Google Drive account'
    };
  }

  // Helper methods - kept for backward compatibility
  async ensureRecipeFolder() {
    if (this.recipeFolderId) return;
    
    // Try to restore previously selected folder first
    const restoredFolder = await this.restoreFolderSelection();
    if (restoredFolder) return;

    // If no folder selected, we'll need the user to choose one
    // This will be handled by the UI now
    throw new Error('No recipe folder selected. Please select a folder first.');
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve(); // Already loaded
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // Token persistence methods
  saveToken(tokenResponse = null) {
    const token = tokenResponse || gapi.client.getToken();
    if (token) {
      // Store token with expiry time
      const expiresIn = tokenResponse?.expires_in || 3600; // Default to 1 hour if not provided
      const expiresAt = Date.now() + (expiresIn * 1000);
      const tokenData = {
        access_token: token.access_token,
        expires_at: expiresAt
      };
      
      console.log(`💾 GoogleDrive: Saving token to localStorage`);
      console.log(`💾 GoogleDrive: Token expires in ${expiresIn} seconds (${Math.floor(expiresIn/60)} minutes)`);
      console.log(`💾 GoogleDrive: Token expires at ${new Date(expiresAt).toLocaleString()}`);
      
      // Use localStorage for better persistence across browser sessions
      localStorage.setItem('google_drive_token', JSON.stringify(tokenData));
    }
  }

  getSavedToken() {
    try {
      // Check both localStorage and sessionStorage for backward compatibility
      const savedData = localStorage.getItem('google_drive_token') || 
                       sessionStorage.getItem('google_drive_token');
      if (!savedData) {
        console.log('📖 GoogleDrive: No saved token found in storage');
        return null;
      }
      
      const tokenData = JSON.parse(savedData);
      console.log('📖 GoogleDrive: Found saved token data');
      
      // Check if token is expired
      if (tokenData.expires_at && Date.now() >= tokenData.expires_at) {
        console.log('📖 GoogleDrive: Saved token is expired - removing from storage');
        localStorage.removeItem('google_drive_token');
        sessionStorage.removeItem('google_drive_token');
        return null;
      }
      
      // Migrate from sessionStorage to localStorage if needed
      if (!localStorage.getItem('google_drive_token') && sessionStorage.getItem('google_drive_token')) {
        console.log('📖 GoogleDrive: Migrating token from sessionStorage to localStorage');
        localStorage.setItem('google_drive_token', savedData);
      }
      
      return { 
        access_token: tokenData.access_token,
        expires_at: tokenData.expires_at
      };
    } catch (error) {
      console.error('📖 GoogleDrive: Error retrieving saved token:', error);
      return null;
    }
  }

  clearSavedToken() {
    localStorage.removeItem('google_drive_token');
    sessionStorage.removeItem('google_drive_token');
  }
}

// Register the provider
import { CloudStorageFactory } from './cloud-storage-interface.js';
CloudStorageFactory.register('google-drive', GoogleDriveProvider);