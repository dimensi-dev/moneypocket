# DompetKu 💚

Aplikasi web mobile untuk mencatat uang saku pribadi — sederhana, cepat, modern, dan bisa langsung di-host gratis di **GitHub Pages** tanpa backend server.

Dibangun dengan **HTML5, CSS3, Vanilla JavaScript (ES6)**, dan **Firebase (Authentication + Cloud Firestore)**.

---

## ✨ Fitur Utama

- Login / Register / Lupa Password / Logout (Firebase Authentication)
- Sesi login tersimpan otomatis (tidak perlu login ulang setiap buka web)
- Dashboard dengan ringkasan Saldo, Pemasukan, Pengeluaran, dan Sisa Uang bulan ini (real-time)
- Tambah / Edit / Hapus transaksi lewat Bottom Sheet modal
- Riwayat transaksi dengan filter (Hari Ini, Kemarin, 7 Hari Terakhir, Minggu Ini, Bulan Ini, Bulan Lalu, Semua)
- Pencarian transaksi berdasarkan kategori, keterangan, atau nominal
- Filter lanjutan berdasarkan kategori & jenis transaksi
- Statistik: Pie Chart kategori pengeluaran, Bar Chart pengeluaran per minggu, Line Chart saldo harian (Chart.js)
- Kategori default + kategori custom buatan pengguna
- Profil pengguna (nama, email, tanggal bergabung, jumlah transaksi, total pemasukan/pengeluaran)
- Pengaturan: Dark Mode / Light Mode, Export CSV, Export PDF (cetak), Import Data (CSV), Reset Semua Data, Logout
- Data terpisah per pengguna berdasarkan UID Firebase (aman, lihat `firestore.rules`)
- PWA — bisa diinstal ke layar utama Android/desktop, dengan cache offline dasar
- Animasi: fade, slide, ripple button, loading skeleton, toast notification, modal animation

---

## 🚀 Cara Menjalankan (Setup Firebase)

### 1. Buat Project Firebase
1. Buka [Firebase Console](https://console.firebase.google.com/) → **Add project** → ikuti langkah-langkahnya.
2. Di dalam project, klik ikon **`</>`** (Web) untuk mendaftarkan aplikasi web baru.
3. Salin objek `firebaseConfig` yang muncul.

### 2. Isi Konfigurasi di Kode
Buka file `js/firebase.js`, lalu ganti bagian berikut dengan config kamu:

```js
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY_ANDA",
  authDomain: "GANTI_DENGAN_AUTH_DOMAIN_ANDA",
  projectId: "GANTI_DENGAN_PROJECT_ID_ANDA",
  storageBucket: "GANTI_DENGAN_STORAGE_BUCKET_ANDA",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID_ANDA",
  appId: "GANTI_DENGAN_APP_ID_ANDA"
};
```

### 3. Aktifkan Authentication
Firebase Console → **Build → Authentication → Get started → Sign-in method** → aktifkan **Email/Password**.

### 4. Aktifkan Firestore Database
Firebase Console → **Build → Firestore Database → Create database** → pilih lokasi server terdekat → mulai dalam mode **Production**.

Lalu buka tab **Rules**, dan tempel isi file `firestore.rules` yang sudah disertakan di project ini, lalu **Publish**. Rules ini memastikan setiap pengguna hanya bisa mengakses datanya sendiri.

### 5. Jalankan secara Lokal
Karena `firebase.js` menggunakan `type="module"` bawaan browser? Tidak — project ini pakai Firebase **compat SDK**, jadi cukup buka `index.html` lewat sebuah server statis (bukan langsung `file://`, karena Service Worker butuh HTTP/HTTPS). Contoh termudah:

```bash
# Menggunakan Python
python3 -m http.server 8000

# atau menggunakan Node (npx)
npx serve .
```

Lalu buka `http://localhost:8000` di browser.

### 6. Deploy ke GitHub Pages
1. Push seluruh folder ini ke sebuah repository GitHub.
2. Masuk ke **Settings → Pages** pada repository tersebut.
3. Pilih branch `main` (atau `master`) dan folder `/root`, lalu **Save**.
4. Tunggu beberapa saat, website akan aktif di `https://username.github.io/nama-repo/`.
5. Tambahkan domain GitHub Pages tersebut ke **Firebase Console → Authentication → Settings → Authorized domains** agar login berfungsi.

Tidak perlu server tambahan, tidak perlu PHP/MySQL/Node backend — semua logika berjalan di browser dan Firebase.

---

## 🗂️ Struktur Proyek

```
/
├── index.html            # Splash screen, cek status login
├── login.html            # Halaman login
├── register.html         # Halaman daftar akun
├── forgot-password.html  # Reset password
├── dashboard.html        # Beranda (ringkasan saldo & transaksi terakhir)
├── transaksi.html        # Tambah transaksi + riwayat + filter + pencarian
├── statistik.html        # Pie / Bar / Line chart (Chart.js)
├── profile.html          # Profil pengguna + pengaturan
├── manifest.json         # Konfigurasi PWA
├── service-worker.js     # Offline cache
├── firestore.rules       # Aturan keamanan Firestore (uid-based)
│
├── css/
│   ├── style.css         # Design system utama (warna, komponen, animasi)
│   └── login.css         # Style khusus halaman auth
│
├── js/
│   ├── firebase.js       # Konfigurasi & inisialisasi Firebase
│   ├── auth.js           # Login, register, lupa password, logout, guard halaman
│   ├── app.js             # Utilitas bersama (toast, format, dark mode) + logika dashboard
│   ├── transaksi.js       # Tambah/edit/hapus transaksi, riwayat, filter, pencarian
│   ├── statistik.js       # Logika Pie/Bar/Line chart
│   └── profile.js         # Profil, pengaturan, export/import data
│
└── assets/
    ├── icon/              # Icon PWA (192, 512, maskable, favicon, apple-touch-icon)
    └── logo/              # Logo aplikasi
```

> Catatan: file `js/profile.js` ditambahkan di luar daftar awal untuk memisahkan logika Profil & Pengaturan agar kode tetap rapi dan tidak duplikat, sesuai prinsip "tidak ada kode yang duplikat" pada permintaan awal.

---

## 🔥 Struktur Data Firestore

```
users (collection)
  {uid} (document)
    name: string
    email: string
    createdAt: timestamp

transactions (collection)
  {autoId} (document)
    uid: string
    type: "pemasukan" | "pengeluaran"
    amount: number
    category: string
    description: string
    date: "YYYY-MM-DD"
    time: "HH:mm"
    createdAt: timestamp
```

---

## 🎨 Desain

- Warna dominan putih dengan aksen hijau `#22c55e`
- Rounded corner & soft shadow di seluruh komponen
- Font **Poppins** (Google Fonts) & ikon **Font Awesome**
- Mobile-first, responsif, dengan Bottom Navigation
- Animasi: fade, slide, ripple button, skeleton loading, toast, modal

---

## ⚠️ Catatan Penting

- Ganti seluruh nilai `GANTI_DENGAN_...` pada `js/firebase.js` sebelum digunakan — tanpa ini, aplikasi tidak akan bisa login/menyimpan data.
- Fitur "Export PDF" menggunakan dialog cetak bawaan browser (`window.print()`) — pengguna cukup pilih "Simpan sebagai PDF" pada dialog cetak yang muncul, karena solusi ini tidak memerlukan library tambahan maupun backend.
- Aplikasi ini murni frontend; tidak ada PHP, MySQL, maupun Node.js backend yang digunakan.
