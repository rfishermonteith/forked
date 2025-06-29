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
      gapi.client.setToken(savedToken);
      console.log('Restored saved authentication token');
      
      // Check if already authenticated (this will validate the token)
      this.isAuthenticated = await this.checkAuth();
      
      if (!this.isAuthenticated) {
        console.log('Saved token was invalid or expired');
      }
    } else {
      this.isAuthenticated = false;
    }
  }

  async checkAuth() {
    const token = gapi.client.getToken();
    if (!token) return false;
    
    // Verify token is still valid by making a test API call
    try {
      await gapi.client.drive.about.get({ fields: 'user' });
      return true;
    } catch (error) {
      console.log('Token validation failed:', error);
      // Clear invalid token
      gapi.client.setToken('');
      this.clearSavedToken();
      return false;
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
        this.saveToken();
        
        resolve({ success: true });
      };
      
      // Check if we already have a valid token
      const existingToken = gapi.client.getToken();
      if (existingToken === null) {
        // First time authentication - request with consent
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
  saveToken() {
    const token = gapi.client.getToken();
    if (token) {
      // Store token with expiry time
      const tokenData = {
        access_token: token.access_token,
        expires_at: Date.now() + (token.expires_in * 1000)
      };
      // Use localStorage for better persistence across browser sessions
      localStorage.setItem('google_drive_token', JSON.stringify(tokenData));
    }
  }

  getSavedToken() {
    try {
      // Check both localStorage and sessionStorage for backward compatibility
      const savedData = localStorage.getItem('google_drive_token') || 
                       sessionStorage.getItem('google_drive_token');
      if (!savedData) return null;
      
      const tokenData = JSON.parse(savedData);
      
      // Check if token is expired
      if (Date.now() >= tokenData.expires_at) {
        localStorage.removeItem('google_drive_token');
        sessionStorage.removeItem('google_drive_token');
        return null;
      }
      
      // Migrate from sessionStorage to localStorage if needed
      if (!localStorage.getItem('google_drive_token') && sessionStorage.getItem('google_drive_token')) {
        localStorage.setItem('google_drive_token', savedData);
      }
      
      return { access_token: tokenData.access_token };
    } catch (error) {
      console.error('Error retrieving saved token:', error);
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