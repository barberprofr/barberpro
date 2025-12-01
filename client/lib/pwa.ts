// ✨ Enregistrement simplifié du Service Worker pour PWA installable
// 🎯 Network Only = pas besoin de logique complexe de mise à jour

export function registerServiceWorker(onUpdate?: () => void) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker enregistré:', registration.scope);

          // Vérification automatique des mises à jour toutes les heures
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('❌ Erreur Service Worker:', error);
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

