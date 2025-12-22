// ✨ Service Worker Minimal pour PWA Installable
// 🎯 Stratégie: Network Only (pas de cache agressif)
// ✅ Permet l'installation PWA sans problèmes de versions persistantes

const VERSION = 'v1.0.1'; // Pour tracking uniquement - force update

// Installation - Prend le contrôle immédiatement
self.addEventListener('install', (event) => {
  console.log(`🔧 Service Worker ${VERSION} installé`);
  self.skipWaiting(); // Active immédiatement la nouvelle version
});

// Activation - Nettoie les anciens caches si présents
self.addEventListener('activate', (event) => {
  console.log(`✅ Service Worker ${VERSION} activé`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Supprimer TOUS les anciens caches
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log(`🗑️ Suppression cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Prend le contrôle de toutes les pages immédiatement
      return self.clients.claim();
    })
  );
});

// Fetch - Toujours utiliser le réseau (Network Only)
self.addEventListener('fetch', (event) => {
  // Stratégie: toujours aller chercher sur le réseau
  // Pas de cache = pas de problèmes de versions anciennes
  event.respondWith(
    fetch(event.request).catch((error) => {
      console.error('❌ Fetch failed:', event.request.url, error);
      // Retourner une réponse d'erreur propre
      return new Response('Network error', {
        status: 408,
        statusText: 'Request Timeout',
        headers: new Headers({ 'Content-Type': 'text/plain' })
      });
    })
  );
});
