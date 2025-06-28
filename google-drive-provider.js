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

    // Check if already authenticated
    this.isAuthenticated = await this.checkAuth();
  }

  async checkAuth() {
    return gapi.client.getToken() !== null;
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
      console.log('User signed out successfully');
    }
  }

  async listRecipes() {
    await this.ensureRecipeFolder();
    
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
    const token = gapi.auth.getToken();
    
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

  // Helper methods
  async ensureRecipeFolder() {
    if (this.recipeFolderId) return;

    // Search for existing folder
    const response = await gapi.client.drive.files.list({
      q: "name='RecipeBox' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
      spaces: 'drive'
    });

    if (response.result.files.length > 0) {
      this.recipeFolderId = response.result.files[0].id;
    } else {
      // Create new folder
      const folderResponse = await gapi.client.drive.files.create({
        resource: {
          name: 'RecipeBox',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      this.recipeFolderId = folderResponse.result.id;
    }
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
}

// Register the provider
import { CloudStorageFactory } from './cloud-storage-interface.js';
CloudStorageFactory.register('google-drive', GoogleDriveProvider);