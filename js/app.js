// ====================================================
// APP.JS — Utilitas bersama (toast, format, dark mode, ripple)
// + Logika halaman Dashboard (Beranda)
// ====================================================

// ---------------- KATEGORI DEFAULT ----------------
const DEFAULT_CATEGORIES = [
  { id: "makan", name: "Makan", icon: "🍔" },
  { id: "minuman", name: "Minuman", icon: "🧋" },
  { id: "transport", name: "Transport", icon: "🚌" },
  { id: "hiburan", name: "Hiburan", icon: "🎮" },
  { id: "pendidikan", name: "Pendidikan", icon: "📚" },
  { id: "belanja", name: "Belanja", icon: "🛒" },
  { id: "kesehatan", name: "Kesehatan", icon: "💊" },
  { id: "lainnya", name: "Lainnya", icon: "💡" },
];

function getCustomCategories() {
  try {
    return JSON.parse(localStorage.getItem("dompetku_custom_categories") || "[]");
  } catch {
    return [];
  }
}
function saveCustomCategory(cat) {
  const list = getCustomCategories();
  list.push(cat);
  localStorage.setItem("dompetku_custom_categories", JSON.stringify(list));
}
function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...getCustomCategories()];
}
function getCategoryMeta(name) {
  const all = getAllCategories();
  return all.find((c) => c.name.toLowerCase() === (name || "").toLowerCase()) || {
    icon: "💡",
    name: name || "Lainnya",
  };
}

// ---------------- FORMAT ----------------
function formatRupiah(num) {
  const n = Number(num) || 0;
  return "Rp " + n.toLocaleString("id-ID");
}

function formatTanggalPanjang(date) {
  const opts = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  return date.toLocaleDateString("id-ID", opts);
}

function formatTanggalPendek(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function nowHHMM() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

// ---------------- TOAST ----------------
function ensureToastContainer() {
  let c = document.querySelector(".toast-container");
  if (!c) {
    c = document.createElement("div");
    c.className = "toast-container";
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message, type = "success") {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "fa-circle-check" : "fa-circle-exclamation";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

// ---------------- RIPPLE EFFECT (global) ----------------
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn, .fab, .nav-item");
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height);
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = e.clientX - rect.left - size / 2 + "px";
  ripple.style.top = e.clientY - rect.top - size / 2 + "px";
  btn.style.position = btn.style.position || "relative";
  btn.style.overflow = "hidden";
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
});

// ---------------- DARK MODE ----------------
function applyDarkModePref() {
  const pref = localStorage.getItem("dompetku_dark_mode");
  if (pref === "1") document.body.classList.add("dark-mode");
}
applyDarkModePref();

function toggleDarkMode(checked) {
  document.body.classList.toggle("dark-mode", checked);
  localStorage.setItem("dompetku_dark_mode", checked ? "1" : "0");
}

// ---------------- BOTTOM NAV ACTIVE STATE ----------------
(function highlightActiveNav() {
  const page = window.location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll(".nav-item").forEach((item) => {
    if (item.getAttribute("href") === page) item.classList.add("active");
  });
})();

// ---------------- PWA INSTALL BANNER ----------------
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById("installBanner");
  if (banner && !localStorage.getItem("dompetku_install_dismissed")) {
    setTimeout(() => banner.classList.add("show"), 1200);
  }
});

function installApp() {
  const banner = document.getElementById("installBanner");
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => {
      if (banner) banner.classList.remove("show");
    });
  }
}
function dismissInstallBanner() {
  const banner = document.getElementById("installBanner");
  if (banner) banner.classList.remove("show");
  localStorage.setItem("dompetku_install_dismissed", "1");
}

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker gagal didaftarkan:", err);
    });
  });
}

// ====================================================
// DASHBOARD LOGIC (hanya berjalan jika elemen dashboard ada)
// ====================================================
document.addEventListener("authReady", (e) => {
  const user = e.detail.user;
  if (!user) return;

  // Tampilkan nama & tanggal di header (semua halaman yang punya elemen ini)
  const greetName = document.getElementById("greetName");
  if (greetName) {
    const displayName = user.displayName ? user.displayName.split(" ")[0] : "Sobat Hemat";
    greetName.textContent = displayName;
  }
  const todayDateEl = document.getElementById("todayDate");
  if (todayDateEl) todayDateEl.textContent = formatTanggalPanjang(new Date());

  const avatarInitial = document.querySelectorAll(".avatar-initial");
  avatarInitial.forEach((el) => {
    const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();
    el.textContent = initial;
  });

  // Hanya jalankan sisanya jika ini halaman dashboard
  if (!document.getElementById("summaryGrid")) return;
  loadDashboardData(user.uid);
});

function loadDashboardData(uid) {
  const grid = document.getElementById("summaryGrid");
  const recentList = document.getElementById("recentTxList");

  db.collection("transactions")
    .where("uid", "==", uid)
    .onSnapshot(
      (snapshot) => {
        let saldo = 0,
          pemasukanBulan = 0,
          pengeluaranBulan = 0;

        const now = new Date();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();

        const items = [];
        snapshot.forEach((doc) => {
          const t = doc.data();
          items.push({ id: doc.id, ...t });

          const amount = Number(t.amount) || 0;
          if (t.type === "pemasukan") saldo += amount;
          else saldo -= amount;

          const txDate = new Date(t.date);
          if (txDate.getMonth() === curMonth && txDate.getFullYear() === curYear) {
            if (t.type === "pemasukan") pemasukanBulan += amount;
            else pengeluaranBulan += amount;
          }
        });

        updateSummaryValue("valSaldo", saldo);
        updateSummaryValue("valPemasukan", pemasukanBulan);
        updateSummaryValue("valPengeluaran", pengeluaranBulan);
        updateSummaryValue("valSisa", pemasukanBulan - pengeluaranBulan);

        // Urutkan terbaru & render 5 transaksi terakhir
        items.sort((a, b) => new Date(b.date + " " + (b.time || "00:00")) - new Date(a.date + " " + (a.time || "00:00")));
        renderRecentTx(items.slice(0, 5));
      },
      (err) => {
        console.error(err);
        showToast("Gagal memuat data. Periksa koneksi internet.", "error");
      }
    );
}

function updateSummaryValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = el.dataset.prev ? Number(el.dataset.prev) : null;
  el.textContent = formatRupiah(value);
  el.dataset.prev = value;
  if (prev !== null && prev !== value) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
}

function renderRecentTx(items) {
  const list = document.getElementById("recentTxList");
  if (!list) return;

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-face-smile"></i>
        <p class="empty-title">Belum ada transaksi</p>
        <p>Yuk mulai catat uang saku hari ini.</p>
      </div>`;
    return;
  }

  list.innerHTML = items
    .map((t) => {
      const cat = getCategoryMeta(t.category);
      return `
      <div class="tx-item ${t.type === "pemasukan" ? "income" : "expense"}">
        <div class="tx-icon">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-category">${t.category}</div>
          <div class="tx-desc">${t.description || "-"}</div>
        </div>
        <div class="tx-amount">${t.type === "pemasukan" ? "+" : "-"} ${formatRupiah(t.amount)}</div>
      </div>`;
    })
    .join("");
}
