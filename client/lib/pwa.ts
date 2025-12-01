// Enregistrement du Service Worker pour la PWA
// Enregistrement du Service Worker pour la PWA
export function registerServiceWorker(onUpdate?: () => void) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          console.log('✅ Service Worker enregistré avec succès:', registration.scope);

          // 1. Vérifier si un SW est déjà en attente (mis à jour en arrière-plan)
          if (registration.waiting) {
            console.log('🔄 Service Worker en attente détecté au chargement');
            if (onUpdate) onUpdate();
          }

          // 2. Vérifier les nouvelles mises à jour pendant l'utilisation
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Nouveau service worker disponible et installé
                  console.log('🔄 Nouveau Service Worker disponible (updatefound)');
                  if (onUpdate) onUpdate();
                }
              });
            }
          });

          // 3. Vérification périodique (optionnel, ex: toutes les heures)
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('❌ Erreur lors de l\'enregistrement du Service Worker:', error);
        });
    });

    // Recharger la page quand le nouveau SW prend le contrôle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        window.location.reload();
        refreshing = true;
      }
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

