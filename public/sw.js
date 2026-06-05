const CACHE_NAME = 'vip-wifi-cache-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './config.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching Core Shell Assets...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Purging Stale Cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Ignore browser extensions, non-http, and live-reload WebSocket calls
  if (!req.url.startsWith(self.location.origin) && !req.url.startsWith('https://fonts.')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch dynamically in background to refresh cache (stale-while-revalidate pattern)
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(req, networkResponse);
              });
            }
          })
          .catch(() => { /* mute error */ });
        return cachedResponse;
      }

      return fetch(req)
        .then((networkResponse) => {
          // If response is valid, dynamically cache it
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback offline handler
          if (req.mode === 'navigate') {
            return caches.match('/');
          }
          return null;
        });
    })
  );
});
