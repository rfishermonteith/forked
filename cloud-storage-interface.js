/**
 * Abstract Cloud Storage Interface
 * 
 * This defines the contract that any cloud storage provider must implement.
 * This allows us to swap out Google Drive for Dropbox, OneDrive, S3, etc.
 * without changing the main application code.
 */

export class CloudStorageProvider {
  constructor(config = {}) {
    this.config = config;
    this.isAuthenticated = false;
  }

  /**
   * Initialize the storage provider
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error('init() must be implemented by provider');
  }

  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async checkAuth() {
    throw new Error('checkAuth() must be implemented by provider');
  }

  /**
   * Authenticate the user
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by provider');
  }

  /**
   * Sign out the user
   * @returns {Promise<void>}
   */
  async signOut() {
    throw new Error('signOut() must be implemented by provider');
  }

  /**
   * List all recipes
   * @returns {Promise<Array<{id: string, name: string, lastModified: Date, size: number}>>}
   */
  async listRecipes() {
    throw new Error('listRecipes() must be implemented by provider');
  }

  /**
   * Get a specific recipe
   * @param {string} id - Recipe identifier
   * @returns {Promise<{id: string, name: string, content: string, lastModified: Date}>}
   */
  async getRecipe(id) {
    throw new Error('getRecipe() must be implemented by provider');
  }

  /**
   * Save a recipe (create or update)
   * @param {string} name - Recipe filename (e.g., "chocolate-cake.md")
   * @param {string} content - Recipe content in markdown
   * @returns {Promise<{id: string, success: boolean}>}
   */
  async saveRecipe(name, content) {
    throw new Error('saveRecipe() must be implemented by provider');
  }

  /**
   * Delete a recipe
   * @param {string} id - Recipe identifier
   * @returns {Promise<{success: boolean}>}
   */
  async deleteRecipe(id) {
    throw new Error('deleteRecipe() must be implemented by provider');
  }

  /**
   * Get sync status
   * @returns {Promise<{
   *   isOnline: boolean,
   *   lastSync: Date|null,
   *   pendingChanges: number
   * }>}
   */
  async getSyncStatus() {
    throw new Error('getSyncStatus() must be implemented by provider');
  }

  /**
   * Get provider info
   * @returns {{name: string, icon: string, description: string}}
   */
  getInfo() {
    throw new Error('getInfo() must be implemented by provider');
  }
}

/**
 * Factory for creating storage providers
 */
export class CloudStorageFactory {
  static providers = new Map();

  /**
   * Register a storage provider
   * @param {string} name - Provider name (e.g., 'google-drive')
   * @param {Class} providerClass - Class that extends CloudStorageProvider
   */
  static register(name, providerClass) {
    this.providers.set(name, providerClass);
  }

  /**
   * Create a storage provider instance
   * @param {string} name - Provider name
   * @param {Object} config - Provider-specific configuration
   * @returns {CloudStorageProvider}
   */
  static create(name, config = {}) {
    const ProviderClass = this.providers.get(name);
    if (!ProviderClass) {
      throw new Error(`Unknown storage provider: ${name}`);
    }
    return new ProviderClass(config);
  }

  /**
   * Get list of available providers
   * @returns {Array<{name: string, info: Object}>}
   */
  static getAvailableProviders() {
    const available = [];
    for (const [name, ProviderClass] of this.providers) {
      const tempInstance = new ProviderClass();
      available.push({
        name,
        info: tempInstance.getInfo()
      });
    }
    return available;
  }
}