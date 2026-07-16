// ====================================================
// AUTH.JS — Logika autentikasi (Login, Register, Logout, Lupa Password)
// Membutuhkan firebase.js sudah dimuat sebelumnya.
// ====================================================

// Simpan sesi login di localStorage bawaan Firebase (persistence LOCAL)
// sehingga pengguna tidak perlu login kembali setiap membuka website.
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

/**
 * Helper untuk menampilkan pesan alert pada form auth
 */
function showAuthAlert(elId, message, type = "error") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove("success-alert");
  if (type === "success") el.classList.add("success-alert");
  el.classList.add("show");
}

function hideAuthAlert(elId) {
  const el = document.getElementById(elId);
  if (el) el.classList.remove("show");
}

/**
 * Menerjemahkan kode error Firebase ke Bahasa Indonesia yang mudah dipahami
 */
function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-disabled": "Akun ini telah dinonaktifkan.",
    "auth/user-not-found": "Email belum terdaftar.",
    "auth/wrong-password": "Password yang kamu masukkan salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan login.",
    "auth/weak-password": "Password terlalu lemah, minimal 6 karakter.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
    "auth/network-request-failed": "Koneksi internet bermasalah.",
  };
  return map[code] || "Terjadi kesalahan. Silakan coba lagi.";
}

function setBtnLoading(btn, loading, label) {
  if (!btn) return;
  if (loading) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = label || btn.dataset.label || "Simpan";
    btn.disabled = false;
  }
}

// ---------------- REGISTER ----------------
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthAlert("registerAlert");

    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value;
    const btn = document.getElementById("registerBtn");

    if (name.length < 2) {
      showAuthAlert("registerAlert", "Nama minimal 2 karakter.");
      return;
    }
    if (password.length < 6) {
      showAuthAlert("registerAlert", "Password minimal 6 karakter.");
      return;
    }

    setBtnLoading(btn, true);
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });

      // Simpan data user ke Firestore koleksi "users"
      await db.collection("users").doc(cred.user.uid).set({
        name: name,
        email: email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      window.location.href = "dashboard.html";
    } catch (err) {
      showAuthAlert("registerAlert", translateAuthError(err.code));
      setBtnLoading(btn, false, "Daftar");
    }
  });
}

// ---------------- LOGIN ----------------
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthAlert("loginAlert");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");

    setBtnLoading(btn, true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      showAuthAlert("loginAlert", translateAuthError(err.code));
      setBtnLoading(btn, false, "Masuk");
    }
  });
}

// ---------------- LUPA PASSWORD ----------------
const forgotForm = document.getElementById("forgotForm");
if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAuthAlert("forgotAlert");

    const email = document.getElementById("forgotEmail").value.trim();
    const btn = document.getElementById("forgotBtn");

    setBtnLoading(btn, true);
    try {
      await auth.sendPasswordResetEmail(email);
      showAuthAlert(
        "forgotAlert",
        "Link reset password telah dikirim ke email kamu.",
        "success"
      );
      setBtnLoading(btn, false, "Kirim Link Reset");
    } catch (err) {
      showAuthAlert("forgotAlert", translateAuthError(err.code));
      setBtnLoading(btn, false, "Kirim Link Reset");
    }
  });
}

// ---------------- LOGOUT ----------------
function handleLogout() {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}
document.querySelectorAll("[data-action='logout']").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    handleLogout();
  });
});

// ---------------- GUARD HALAMAN ----------------
// Halaman yang butuh login (semua kecuali login/register/forgot/index)
const PUBLIC_PAGES = ["login.html", "register.html", "index.html"];
const currentPage = window.location.pathname.split("/").pop() || "index.html";

auth.onAuthStateChanged((user) => {
  const isPublic = PUBLIC_PAGES.includes(currentPage);

  if (!user && !isPublic) {
    // Belum login tapi buka halaman privat -> lempar ke login
    window.location.href = "login.html";
    return;
  }

  if (user && (currentPage === "login.html" || currentPage === "register.html")) {
    // Sudah login tapi buka halaman login/register -> lempar ke dashboard
    window.location.href = "dashboard.html";
    return;
  }

  // Broadcast event supaya halaman lain (app.js dll) tahu user sudah siap
  document.dispatchEvent(new CustomEvent("authReady", { detail: { user } }));
});

// Toggle show/hide password
document.querySelectorAll(".toggle-visibility").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const input = document.getElementById(toggle.dataset.target);
    if (!input) return;
    const isPass = input.type === "password";
    input.type = isPass ? "text" : "password";
    toggle.classList.toggle("fa-eye");
    toggle.classList.toggle("fa-eye-slash");
  });
});

// Indikator kekuatan password sederhana (register.html)
const regPasswordInput = document.getElementById("regPassword");
if (regPasswordInput) {
  regPasswordInput.addEventListener("input", () => {
    const val = regPasswordInput.value;
    const bars = document.querySelectorAll("#strengthMeter .bar");
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    bars.forEach((bar, i) => {
      bar.style.background =
        i < score
          ? score === 1
            ? "var(--color-danger)"
            : score === 2
            ? "#f59e0b"
            : "var(--color-primary)"
          : "var(--color-border)";
    });
  });
}
