const VERSION = '0.0.1';
const CACHE_NAME = `recipe-app-v${VERSION}`;
const urlsToCache = [
  '/forked/',
  '/forked/index.html',
  '/forked/manifest.json',
  '/forked/icons/icon-192.png',
  '/forked/icons/icon-512.png',
  '/forked/sw.js',
  // External dependencies - using CDN URLs from index.html
  'https://cdn.jsdelivr.net/npm/gray-matter@4/+esm',
  'https://cdn.jsdelivr.net/npm/markdown-it@14/+esm',
  'https://cdn.jsdelivr.net/npm/dompurify@3/+esm',
  'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Cache files individually to handle failures gracefully
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => {
              console.warn('Failed to cache:', url, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          // Add to cache if it's a same-origin resource or CDN resource
          const url = new URL(event.request.url);
          if (url.origin === location.origin || 
              url.hostname === 'unpkg.com' ||
              url.hostname === 'cdn.jsdelivr.net') {
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }

          return response;
        }).catch(error => {
          // Offline fallback
          console.log('Fetch failed, serving offline fallback:', error);
          
          // For navigation requests, return the cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/forked/index.html') || caches.match('/forked/');
          }
          
          // For other requests, try to find something in cache
          return caches.match(event.request.url) || 
                 caches.match(event.request.url.replace(/\/$/, '/index.html'));
        });
      })
  );
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});