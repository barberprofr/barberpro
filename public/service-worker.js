const CACHE_NAME = 'barberpro-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => key !== CACHE_NAME && caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 🔹 Ne jamais intercepter les API
  if (req.url.includes('/api/')) return;

  // 🔹 Navigation (HTML) - Network First
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // 🔹 Assets statiques - Cache First
  event.respondWith(
    caches.match(req).then((res) => {
      if (res) return res;
      return fetch(req).then((fetched) => {
        if (!fetched || fetched.status !== 200) return fetched;
        const clone = fetched.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        return fetched;
      }).catch((error) => {
        console.error('Static asset fetch failed:', req.url, error);
        throw error;
      });
    })
  );
});
