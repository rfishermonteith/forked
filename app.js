// IMPORTS
import matter from 'https://cdn.jsdelivr.net/npm/gray-matter@4/+esm';
import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14/+esm';
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3/+esm';
import { get, set, clear } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

// Import cloud sync modules
import '/forked/cloud-storage-interface.js';
import '/forked/google-drive-provider.js';
import { SyncManager } from '/forked/sync-manager.js';

// Import our new modules
import { RecipeManager } from './recipe-manager.js';
import { UIController } from './ui-controller.js';
import { SyncController } from './sync-controller.js';

// CONSTANTS
const SYNC_PROGRESS_HIDE_DELAY = 3000;
const PWA_INSTALL_DELAY = 10000;
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
const DEFAULT_RECIPE_FOLDER_NAME = 'RecipeBox';
const STORAGE_KEYS = {
  RECIPE_DIR_HANDLE: 'recipeDirHandle',
  RECIPE_DATA: 'recipeData',
  IMAGE_DATA: 'imageData',
  LAST_SYNC_TIME: 'lastSyncTime',
  LAST_VIEWED_RECIPE: 'lastViewedRecipe',
  APP_INSTALLED: 'appInstalled',
  SELECTED_RECIPE_FOLDER: 'selectedRecipeFolderId',
  GOOGLE_AUTH_IN_PROGRESS: 'google_drive_auth_in_progress'
};
const FILE_EXTENSIONS = {
  MARKDOWN: '.md',
  IMAGES: /\.(jpg|jpeg|png|webp)$/i
};

// INITIALIZATION
const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// GLOBAL STATE
let dirHandle = null;
const slugToFile = new Map();
const slugToImage = new Map();
const syncManager = new SyncManager();
let syncEnabled = false;

// Initialize the application
export class App {
  constructor() {
    this.recipeManager = new RecipeManager(md, slugToFile, slugToImage, STORAGE_KEYS, FILE_EXTENSIONS);
    this.uiController = new UIController();
    this.syncController = new SyncController(syncManager, this.recipeManager);
    
    this.init();
  }
  
  async init() {
    // Initialize core components
    await this.recipeManager.init();
    
    // Load initial state (recipes) first
    await this.loadInitialState();
    
    // Then initialize UI components (after recipes are loaded)
    await this.uiController.init();
    await this.syncController.init();
    
    // Set up routing
    this.setupRouting();
    
    // Set up PWA features
    this.setupPWA();
    
    // Set up file picker
    this.setupFilePicker();
    
    // Set up service worker
    this.setupServiceWorker();
  }
  
  setupRouting() {
    window.addEventListener('hashchange', () => this.handleHashChange());
  }
  
  async setupPWA() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install banner after delay if not already installed
      setTimeout(async () => {
        const isInstalled = await get(STORAGE_KEYS.APP_INSTALLED);
        if (!isInstalled && deferredPrompt) {
          this.uiController.showInstallBanner();
        }
      }, PWA_INSTALL_DELAY);
    });
    
    // Handle install button click
    this.uiController.onInstallClick(async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      deferredPrompt = null;
      this.uiController.hideInstallBanner();
    });
    
    // Handle app installation
    window.addEventListener('appinstalled', async () => {
      console.log('Recipe Box app installed');
      this.uiController.hideInstallBanner();
      await set(STORAGE_KEYS.APP_INSTALLED, true);
    });
  }
  
  setupFilePicker() {
    const pickBtn = document.getElementById('pickDir');
    pickBtn?.addEventListener('click', async () => {
      dirHandle = await this.pickRecipeFolder();
      if (dirHandle) {
        // Save both directory handles and file arrays
        if (dirHandle.kind === 'directory') {
          // Modern browsers: save directory handle
          await set(STORAGE_KEYS.RECIPE_DIR_HANDLE, dirHandle);
        } else if (Array.isArray(dirHandle)) {
          // Fallback browsers: Store recipe content in IndexedDB for persistence
          console.log('Storing recipe files in IndexedDB for persistence...');
          const recipes = [];
          for (const file of dirHandle) {
            if (file.name.endsWith(FILE_EXTENSIONS.MARKDOWN)) {
              const content = await file.text();
              recipes.push({
                name: file.name,
                content: content,
                lastModified: file.lastModified,
                size: file.size
              });
            }
          }
          await set(STORAGE_KEYS.RECIPE_DATA, recipes);
          console.log(`Stored ${recipes.length} recipes in IndexedDB`);
        }
        await this.recipeManager.renderIndex(dirHandle);
        this.handleHashChange(); // Re-route to handle current hash
      }
    });
  }
  
  async pickRecipeFolder() {
    if ('showDirectoryPicker' in window) {
      // Modern Chromium path (read + write)
      return await window.showDirectoryPicker();
    }
    
    // Fallback: let user pick a whole folder read-only (WebKit proprietary)
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.addEventListener('change', () => {
        resolve(Array.from(input.files));
      });
      input.click();
    });
  }
  
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      console.log('Service Worker available');
      
      window.addEventListener('load', async () => {
        try {
          console.log('Attempting to register service worker...');
          const registration = await navigator.serviceWorker.register('/forked/sw.js');
          console.log('Service Worker registered successfully:', registration.scope);
          
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated') {
                console.log('New service worker activated!');
              }
            });
          });
          
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      });
    }
  }
  
  async loadInitialState() {
    try {
      // Try to restore directory handle
      dirHandle = await get(STORAGE_KEYS.RECIPE_DIR_HANDLE);
      
      // Load recipes
      await this.recipeManager.renderIndex(dirHandle);
      
      // Handle initial hash
      this.handleHashChange();
      
    } catch (error) {
      console.error('Failed to load initial state:', error);
    }
  }
  
  handleHashChange() {
    const hash = window.location.hash;
    if (hash.startsWith('#recipe=')) {
      const slug = hash.slice(8);
      this.recipeManager.renderRecipe(slug);
    } else {
      this.recipeManager.renderIndex(dirHandle);
    }
  }
  
  // Expose globals for backward compatibility
  getGlobals() {
    return {
      dirHandle,
      slugToFile,
      slugToImage,
      syncManager,
      syncEnabled,
      STORAGE_KEYS,
      FILE_EXTENSIONS,
      SYNC_PROGRESS_HIDE_DELAY,
      TOKEN_REFRESH_THRESHOLD,
      DEFAULT_RECIPE_FOLDER_NAME
    };
  }
  
  // Update global state
  updateGlobals(updates) {
    if (updates.dirHandle !== undefined) dirHandle = updates.dirHandle;
    if (updates.syncEnabled !== undefined) syncEnabled = updates.syncEnabled;
  }
}

// Application is initialized by the module script in index.html