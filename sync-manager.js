import { get, set } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';
import { CloudStorageFactory } from './cloud-storage-interface.js';

/**
 * Manages synchronization between local IndexedDB and cloud storage
 * This is provider-agnostic and works with any CloudStorageProvider
 */
export class SyncManager {
  constructor() {
    this.provider = null;
    this.syncInProgress = false;
    this.lastSyncTime = null;
  }

  /**
   * Initialize with a specific cloud provider
   * @param {string} providerName - Name of the provider (e.g., 'google-drive')
   * @param {Object} config - Provider-specific configuration
   */
  async initProvider(providerName, config = {}) {
    try {
      this.provider = CloudStorageFactory.create(providerName, config);
      await this.provider.init();
      
      // Restore last sync time
      this.lastSyncTime = await get('lastSyncTime') || null;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize provider:', error);
      return false;
    }
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return this.provider ? this.provider.getInfo() : null;
  }

  /**
   * Check if authenticated with cloud provider
   */
  async isAuthenticated() {
    return this.provider && await this.provider.checkAuth();
  }

  /**
   * Authenticate with cloud provider
   */
  async authenticate() {
    if (!this.provider) {
      throw new Error('No provider initialized');
    }
    return await this.provider.authenticate();
  }

  /**
   * Sign out from cloud provider
   */
  async signOut() {
    if (this.provider) {
      await this.provider.signOut();
    }
  }

  /**
   * Perform full sync between local and cloud
   * @param {Function} progressCallback - Called with sync progress
   */
  async sync(progressCallback) {
    if (this.syncInProgress) {
      console.log('Sync already in progress');
      return { success: false, error: 'Sync already in progress' };
    }

    try {
      this.syncInProgress = true;
      progressCallback?.({ status: 'starting', progress: 0 });

      // Get local recipes and images
      const localRecipes = await get('recipeData') || [];
      const localImages = await get('imageData') || [];
      progressCallback?.({ status: 'loading-local', progress: 10 });

      // Get cloud recipes and images
      const cloudRecipes = await this.provider.listRecipes();
      const cloudImages = await this.provider.listImages();
      progressCallback?.({ status: 'loading-cloud', progress: 20 });

      // Create maps for easier lookup
      const localMap = new Map(localRecipes.map(r => [r.name, r]));
      const cloudMap = new Map(cloudRecipes.map(r => [r.name, r]));
      const localImageMap = new Map(localImages.map(i => [i.name, i]));
      const cloudImageMap = new Map(cloudImages.map(i => [i.name, i]));

      const toUpload = [];
      const toDownload = [];
      const imagesToUpload = [];
      const imagesToDownload = [];
      const conflicts = [];

      // Find what needs to be synced - Recipes
      for (const [name, localRecipe] of localMap) {
        const cloudRecipe = cloudMap.get(name);
        
        if (!cloudRecipe) {
          // Local only - upload
          toUpload.push(localRecipe);
        } else if (localRecipe.lastModified > cloudRecipe.lastModified.getTime()) {
          // Local is newer - upload
          toUpload.push(localRecipe);
        } else if (localRecipe.lastModified < cloudRecipe.lastModified.getTime()) {
          // Cloud is newer - download
          toDownload.push(cloudRecipe);
        }
        // If timestamps are equal, no action needed
      }

      // Find cloud-only recipes
      for (const [name, cloudRecipe] of cloudMap) {
        if (!localMap.has(name)) {
          toDownload.push(cloudRecipe);
        }
      }

      // Find what needs to be synced - Images
      for (const [name, localImage] of localImageMap) {
        const cloudImage = cloudImageMap.get(name);
        
        if (!cloudImage) {
          // Local only - upload
          imagesToUpload.push(localImage);
        } else if (localImage.lastModified > cloudImage.lastModified.getTime()) {
          // Local is newer - upload
          imagesToUpload.push(localImage);
        } else if (localImage.lastModified < cloudImage.lastModified.getTime()) {
          // Cloud is newer - download
          imagesToDownload.push(cloudImage);
        }
      }

      // Find cloud-only images
      for (const [name, cloudImage] of cloudImageMap) {
        if (!localImageMap.has(name)) {
          imagesToDownload.push(cloudImage);
        }
      }

      progressCallback?.({ 
        status: 'syncing', 
        progress: 30,
        details: {
          toUpload: toUpload.length,
          toDownload: toDownload.length,
          imagesToUpload: imagesToUpload.length,
          imagesToDownload: imagesToDownload.length,
          conflicts: conflicts.length
        }
      });

      // Upload local changes
      let processed = 0;
      const total = toUpload.length + toDownload.length + imagesToUpload.length + imagesToDownload.length;

      for (const recipe of toUpload) {
        progressCallback?.({ 
          status: 'uploading', 
          progress: 30 + (processed / total) * 60,
          current: recipe.name
        });

        await this.provider.saveRecipe(recipe.name, recipe.content);
        processed++;
      }

      // Upload local images
      for (const image of imagesToUpload) {
        progressCallback?.({ 
          status: 'uploading-image', 
          progress: 30 + (processed / total) * 60,
          current: image.name
        });

        await this.provider.saveImage(image.name, image.dataUrl);
        processed++;
      }

      // Download cloud changes
      const updatedLocalRecipes = [...localRecipes];
      const updatedLocalImages = [...localImages];
      
      for (const cloudRecipe of toDownload) {
        progressCallback?.({ 
          status: 'downloading', 
          progress: 30 + (processed / total) * 60,
          current: cloudRecipe.name
        });

        const fullRecipe = await this.provider.getRecipe(cloudRecipe.id);
        
        // Update or add to local
        const existingIndex = updatedLocalRecipes.findIndex(r => r.name === fullRecipe.name);
        const localRecipe = {
          name: fullRecipe.name,
          content: fullRecipe.content,
          lastModified: fullRecipe.lastModified.getTime(),
          size: fullRecipe.content.length
        };

        if (existingIndex >= 0) {
          updatedLocalRecipes[existingIndex] = localRecipe;
        } else {
          updatedLocalRecipes.push(localRecipe);
        }
        
        processed++;
      }

      // Download cloud images
      for (const cloudImage of imagesToDownload) {
        progressCallback?.({ 
          status: 'downloading-image', 
          progress: 30 + (processed / total) * 60,
          current: cloudImage.name
        });

        const fullImage = await this.provider.getImage(cloudImage.id);
        
        // Update or add to local
        const existingIndex = updatedLocalImages.findIndex(i => i.name === fullImage.name);
        const localImage = {
          name: fullImage.name,
          dataUrl: fullImage.dataUrl,
          mimeType: fullImage.mimeType,
          lastModified: fullImage.lastModified.getTime()
        };

        if (existingIndex >= 0) {
          updatedLocalImages[existingIndex] = localImage;
        } else {
          updatedLocalImages.push(localImage);
        }
        
        processed++;
      }

      // Save updated recipes and images to IndexedDB
      await set('recipeData', updatedLocalRecipes);
      await set('imageData', updatedLocalImages);
      
      // Update last sync time
      this.lastSyncTime = new Date();
      await set('lastSyncTime', this.lastSyncTime.getTime());

      progressCallback?.({ status: 'complete', progress: 100 });

      return {
        success: true,
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        uploadedImages: imagesToUpload.length,
        downloadedImages: imagesToDownload.length,
        conflicts: conflicts.length
      };

    } catch (error) {
      console.error('Sync error:', error);
      progressCallback?.({ status: 'error', progress: 0, error: error.message });
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get sync status
   */
  async getStatus() {
    if (!this.provider) {
      return { connected: false, lastSync: null };
    }

    const status = await this.provider.getSyncStatus();
    return {
      connected: status.isOnline,
      lastSync: this.lastSyncTime,
      provider: this.provider.getInfo().name,
      syncInProgress: this.syncInProgress
    };
  }
}