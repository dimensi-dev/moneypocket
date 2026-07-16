// ====================================================
// FIREBASE CONFIGURATION
// ====================================================
// GANTI konfigurasi di bawah ini dengan konfigurasi project
// Firebase kamu sendiri. Kamu bisa mendapatkannya di:
// Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
//
// Setelah itu, pastikan kamu sudah mengaktifkan:
// 1. Authentication > Sign-in method > Email/Password
// 2. Firestore Database (mode production / test, lalu atur rules
//    sesuai file firestore.rules yang disertakan di README)
// ====================================================

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_ANDA",
  authDomain: "GANTI_DENGAN_AUTH_DOMAIN_ANDA",
  projectId: "GANTI_DENGAN_PROJECT_ID_ANDA",
  storageBucket: "GANTI_DENGAN_STORAGE_BUCKET_ANDA",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID_ANDA",
  appId: "GANTI_DENGAN_APP_ID_ANDA"
};

// Inisialisasi Firebase (menggunakan Firebase v9 compat SDK
// agar mudah dipakai langsung di browser tanpa bundler / build step)
firebase.initializeApp(firebaseConfig);

// Ekspor instance yang akan dipakai di file js lain
const auth = firebase.auth();
const db = firebase.firestore();

// Aktifkan cache offline Firestore agar aplikasi tetap bisa
// menampilkan data terakhir saat koneksi terputus (mendukung fitur PWA)
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Firestore persistence tidak aktif:", err.code);
});
