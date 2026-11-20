/* Service Worker — الشاطبية التفاعلية الكاملة (Offline PWA) */
const CACHE_NAME = 'shatibiyyah-pwa-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/audio-player.js',
  './assets/js/symbol-trainer.js',
  './assets/icons/icon-192.svg',
  './assets/icons/icon-512.svg',
  './data/shatibiyyah_full.js',
  './data/commentaries/index.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Skip range requests for large audio files or non-http(s) schemes
  if (req.headers.get('range') || !url.protocol.startsWith('http')) return;

  // Same-origin: Cache-first with background update for smooth offline experience
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
