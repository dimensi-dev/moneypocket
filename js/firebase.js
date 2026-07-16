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
  apiKey: "AIzaSyDH4VKNTmKo39gRe6-MmE4MVWyiwjymHgE",
  authDomain: "dimen-4c38b.firebaseapp.com",
  projectId: "dimen-4c38b",
  storageBucket: "dimen-4c38b.firebasestorage.app",
  messagingSenderId: "971015738210",
  appId: "1:971015738210:web:6b6a181b81edb3ce8d123b",
  measurementId: "G-X60VY0EB3B"
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
