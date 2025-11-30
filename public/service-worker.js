const CACHE_NAME = 'barberpro-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Navigation (HTML) - Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch((error) => {
          console.log('Navigation fetch failed, falling back to cache:', error);
          return caches.match(request);
        })
    );
    return;
  }

  // 2. API requests - Network First
  if (request.url.includes('/api/')) {
    if (request.method !== 'GET') {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch((error) => {
          console.log('API fetch failed, falling back to cache:', error);
          return caches.match(request);
        })
    );
    return;
  }

  // 3. Assets statiques (JS, CSS, Images) - Cache First
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch((error) => {
          console.error('Static asset fetch failed:', request.url, error);
          // On ne peut pas faire grand chose ici si l'asset n'est pas en cache
          // et que le réseau échoue, à part retourner une erreur ou une image par défaut.
          throw error;
        });
    })
  );
});
