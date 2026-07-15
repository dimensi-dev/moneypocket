/* =========================================================================
   MONEY POCKET — SERVICE WORKER
   Strategi: Cache First untuk app shell (HTML/CSS/JS/ikon),
   Network First (dengan fallback cache) untuk aset eksternal seperti
   Chart.js dan Google Fonts, sehingga aplikasi tetap bisa dibuka offline.
   ========================================================================= */

const CACHE_NAME = 'money-pocket-cache-v1';

// Daftar file inti yang wajib tersedia offline (app shell)
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

/* ----------------------------------------------------------------------
   INSTALL: simpan app shell ke cache
---------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      /* jika salah satu gagal di-cache, jangan gagalkan seluruh instalasi */
    })
  );
  self.skipWaiting();
});

/* ----------------------------------------------------------------------
   ACTIVATE: bersihkan cache versi lama
---------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

/* ----------------------------------------------------------------------
   FETCH: strategi cache
   - App shell (same-origin): Cache First
   - Aset eksternal (CDN Chart.js, Google Fonts): Network First + fallback cache
---------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (isSameOrigin) {
    // Cache First untuk file aplikasi sendiri
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
            return res;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
  } else {
    // Network First untuk CDN eksternal (Chart.js, Google Fonts)
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  }
});
