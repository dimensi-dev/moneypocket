// ====================================================
// SERVICE WORKER — Offline cache untuk DompetKu (PWA)
// ====================================================

const CACHE_NAME = "dompetku-cache-v3";

// File inti (app shell) yang harus tersedia secara offline.
// Sengaja tidak meng-cache request ke Firebase agar data tetap real-time.
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./login.html",
  "./register.html",
  "./forgot-password.html",
  "./dashboard.html",
  "./transaksi.html",
  "./statistik.html",
  "./profile.html",
  "./manifest.json",
  "./css/style.css",
  "./css/login.css",
  "./js/firebase.js",
  "./js/auth.js",
  "./js/app.js",
  "./js/transaksi.js",
  "./js/statistik.js",
  "./js/profile.js",
  "./assets/icon/icon-192.png",
  "./assets/icon/icon-512.png",
  "./assets/logo/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch((err) => {
      console.warn("Gagal cache sebagian aset:", err);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jangan cache request ke Firebase / Google API / CDN eksternal berbasis data.
  // Biarkan request-request ini langsung ke jaringan (network-first / passthrough).
  const isExternalDataRequest =
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("identitytoolkit");

  if (isExternalDataRequest || event.request.method !== "GET") {
    return; // biarkan browser menangani seperti biasa
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Simpan salinan aset statis baru ke cache (best-effort)
          if (response && response.status === 200 && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
