/**
 * service-worker.js — Mise en cache de l'application pour un
 * fonctionnement hors-ligne (PWA). Ne touche jamais aux données
 * métier (ventes, catalogue), qui restent gérées par l'app elle-même
 * via localStorage — ce service worker ne fait que mettre en cache
 * les fichiers de l'application (HTML/CSS/JS/icônes).
 */
const CACHE_NOM = 'caisse-friterie-v1';

const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/style.css',
  './data/catalogue.json',
  './js/app.js',
  './js/config.js',
  './js/stockage.js',
  './js/catalogue.js',
  './js/catalogue-patch.js',
  './js/panier.js',
  './js/calculatrice.js',
  './js/ticket.js',
  './js/ventes.js',
  './js/numerotation.js',
  './js/cloture.js',
  './js/export.js',
  './js/github-sync.js',
  './js/clavier.js',
  './js/ui-modal.js',
  './js/ui-menu.js',
  './js/ui-paiement.js',
  './js/ui-historique.js',
  './js/ui-export.js',
  './js/ui-gestion.js',
  './js/ui-parametres.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NOM).then(cache => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(noms => Promise.all(
      noms.filter(n => n !== CACHE_NOM).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ne jamais intercepter les appels vers l'API GitHub : toujours en direct
  if (event.request.url.includes('api.github.com')) return;
  // Seules les requêtes GET peuvent être mises en cache
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(reponseEnCache => {
      if (reponseEnCache) return reponseEnCache;
      return fetch(event.request).then(reponseReseau => {
        if (reponseReseau.ok && event.request.url.startsWith(self.location.origin)) {
          const copie = reponseReseau.clone();
          caches.open(CACHE_NOM).then(cache => cache.put(event.request, copie));
        }
        return reponseReseau;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
