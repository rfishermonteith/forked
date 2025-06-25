const CACHE_NAME = 'recipe-app-v1';
const urlsToCache = [
  '/forked/',
  '/forked/index.html',
  '/forked/manifest.json',
  '/forked/icons/icon-192.png',
  '/forked/icons/icon-512.png',
  // External dependencies
  'https://unpkg.com/gray-matter@4.0.3/dist/gray-matter.js',
  'https://unpkg.com/markdown-it@13.0.2/dist/markdown-it.min.js',
  'https://unpkg.com/dompurify@3.0.8/dist/purify.min.js',
  'https://unpkg.com/idb-keyval@6.2.1/dist/umd.js'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
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
          if (!response || response.status !== 200 || response.type === 'opaque') {
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
        }).catch(() => {
          // Offline fallback
          if (event.request.destination === 'document') {
            return caches.match('/forked/index.html');
          }
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