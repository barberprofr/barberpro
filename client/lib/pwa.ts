// Enregistrement du Service Worker pour la PWA
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker enregistré avec succès:', registration.scope);
          
          // Vérifier les mises à jour du service worker
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouveau service worker disponible
                  console.log('🔄 Nouveau Service Worker disponible');
                  // Optionnel : afficher une notification à l'utilisateur
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
        });
    });
  }
}

// Fonction pour détecter si l'application est installée
export function isPWAInstalled(): boolean {
  // Vérifier si l'app est en mode standalone (installée)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // Vérifier pour iOS
  if ((window.navigator as any).standalone === true) {
    return true;
  }
  return false;
}

// Fonction pour détecter si l'installation est disponible
export function canInstallPWA(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

