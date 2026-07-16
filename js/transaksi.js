// ====================================================
// TRANSAKSI.JS — Tambah, Edit, Hapus, Riwayat, Filter & Pencarian
// ====================================================

let currentUid = null;
let allTransactions = [];
let activeRange = "semua";
let pendingDeleteId = null;
let selectedType = "pemasukan";
let selectedCategory = "";

const overlay = document.getElementById("overlay");
const txSheet = document.getElementById("txSheet");
const deleteModal = document.getElementById("deleteModal");

// ---------------- INIT SETELAH LOGIN ----------------
document.addEventListener("authReady", (e) => {
  const user = e.detail.user;
  if (!user) return;
  currentUid = user.uid;

  renderCategoryPicker();
  populateFilterCategorySelect();
  listenTransactions();

  // Buka sheet otomatis jika datang dari FAB dashboard / kategori cepat
  const params = new URLSearchParams(window.location.search);
  if (params.get("add") === "1") {
    openSheet("add");
    const cat = params.get("category");
    if (cat) selectCategory(cat, "pengeluaran");
  }
});

// ---------------- LISTENER FIRESTORE ----------------
function listenTransactions() {
  db.collection("transactions")
    .where("uid", "==", currentUid)
    .onSnapshot(
      (snapshot) => {
        allTransactions = [];
        snapshot.forEach((doc) => allTransactions.push({ id: doc.id, ...doc.data() }));
        allTransactions.sort(
          (a, b) => new Date(b.date + " " + (b.time || "00:00")) - new Date(a.date + " " + (a.time || "00:00"))
        );
        renderTxList();
      },
      (err) => {
        console.error(err);
        showToast("Gagal memuat riwayat transaksi.", "error");
      }
    );
}

// ---------------- FILTER TANGGAL ----------------
function isInRange(dateStr, range) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (range === "semua") return true;
  if (range === "hari-ini") return d.getTime() === now.getTime();
  if (range === "kemarin") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return d.getTime() === y.getTime();
  }
  if (range === "7-hari") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return d >= start && d <= now;
  }
  if (range === "minggu-ini") {
    const start = new Date(now);
    const day = start.getDay() === 0 ? 7 : start.getDay(); // Senin = 1
    start.setDate(start.getDate() - (day - 1));
    return d >= start && d <= now;
  }
  if (range === "bulan-ini") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (range === "bulan-lalu") {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
  }
  return true;
}

// ---------------- RENDER LIST ----------------
function renderTxList() {
  const container = document.getElementById("txListContainer");
  if (!container) return;

  const search = (document.getElementById("searchInput").value || "").toLowerCase().trim();
  const filterKategori = document.getElementById("filterKategori").value;
  const filterJenis = document.getElementById("filterJenis").value;

  let items = allTransactions.filter((t) => isInRange(t.date, activeRange));

  if (filterKategori) items = items.filter((t) => t.category === filterKategori);
  if (filterJenis) items = items.filter((t) => t.type === filterJenis);

  if (search) {
    items = items.filter((t) => {
      return (
        (t.category || "").toLowerCase().includes(search) ||
        (t.description || "").toLowerCase().includes(search) ||
        String(t.amount || "").includes(search)
      );
    });
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        <p class="empty-title">Tidak ada transaksi</p>
        <p>Coba ubah filter atau kata kunci pencarian kamu.</p>
      </div>`;
    return;
  }

  // Kelompokkan berdasarkan tanggal
  const groups = {};
  items.forEach((t) => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  let html = "";
  Object.keys(groups)
    .sort((a, b) => new Date(b) - new Date(a))
    .forEach((date) => {
      html += `<div class="date-group-label">${formatTanggalPendek(date)}</div>`;
      html += `<div class="tx-list">`;
      groups[date].forEach((t) => {
        const cat = getCategoryMeta(t.category);
        html += `
        <div class="tx-item ${t.type === "pemasukan" ? "income" : "expense"}">
          <div class="tx-icon">${cat.icon}</div>
          <div class="tx-info">
            <div class="tx-category">${t.category}</div>
            <div class="tx-desc">${t.description || "-"}</div>
            <div class="tx-meta">${t.time || ""}</div>
          </div>
          <div class="tx-amount">${t.type === "pemasukan" ? "+" : "-"} ${formatRupiah(t.amount)}</div>
          <div class="tx-actions">
            <button onclick="openSheet('edit','${t.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button onclick="askDelete('${t.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
      });
      html += `</div>`;
    });

  container.innerHTML = html;
}

// ---------------- FILTER CHIPS ----------------
document.getElementById("filterChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeRange = chip.dataset.range;
  renderTxList();
});

document.getElementById("filterToggleBtn").addEventListener("click", () => {
  const panel = document.getElementById("filterPanel");
  panel.classList.toggle("open");
  document.getElementById("filterToggleBtn").classList.toggle("has-filter", panel.classList.contains("open"));
});

document.getElementById("filterKategori").addEventListener("change", renderTxList);
document.getElementById("filterJenis").addEventListener("change", renderTxList);

// ---------------- SEARCH ----------------
let searchDebounce;
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(renderTxList, 200);
});

function populateFilterCategorySelect() {
  const select = document.getElementById("filterKategori");
  getAllCategories().forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = `${c.icon} ${c.name}`;
    select.appendChild(opt);
  });
}

// ---------------- SHEET TAMBAH / EDIT ----------------
function openSheet(mode, id) {
  document.getElementById("txForm").reset();
  document.getElementById("txId").value = "";
  document.getElementById("sheetTitle").textContent = mode === "edit" ? "Edit Transaksi" : "Tambah Transaksi";

  if (mode === "edit") {
    const t = allTransactions.find((x) => x.id === id);
    if (!t) return;
    document.getElementById("txId").value = t.id;
    document.getElementById("txNominal").value = Number(t.amount).toLocaleString("id-ID");
    document.getElementById("txDate").value = t.date;
    document.getElementById("txTime").value = t.time;
    document.getElementById("txDesc").value = t.description || "";
    setSegmented(t.type);
    selectCategory(t.category, t.type, true);
  } else {
    document.getElementById("txDate").value = todayISO();
    document.getElementById("txTime").value = nowHHMM();
    setSegmented("pemasukan");
    renderCategoryPicker();
  }

  overlay.classList.add("show");
  txSheet.classList.add("show");
}

function closeSheet() {
  overlay.classList.remove("show");
  txSheet.classList.remove("show");
  deleteModal.classList.remove("show");
}

document.getElementById("fabAdd").addEventListener("click", () => openSheet("add"));
document.getElementById("closeSheetBtn").addEventListener("click", closeSheet);
overlay.addEventListener("click", closeSheet);

// ---------------- SEGMENTED (Jenis) ----------------
function setSegmented(type) {
  selectedType = type;
  document.querySelectorAll("#jenisSegmented button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  renderCategoryPicker();
}
document.getElementById("jenisSegmented").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  setSegmented(btn.dataset.type);
});

// ---------------- KATEGORI PICKER ----------------
function renderCategoryPicker() {
  const wrap = document.getElementById("catPicker");
  const cats = getAllCategories();
  wrap.innerHTML = cats
    .map(
      (c) => `
    <div class="cat-option ${c.name === selectedCategory ? "selected" : ""}" data-name="${c.name}" onclick="selectCategory('${c.name}')">
      <div class="icon-circle">${c.icon}</div>
      <span>${c.name}</span>
    </div>`
    )
    .join("");
  wrap.innerHTML += `
    <div class="cat-option add-cat" onclick="promptNewCategory()">
      <div class="icon-circle"><i class="fa-solid fa-plus"></i></div>
      <span>Tambah</span>
    </div>`;
}

function selectCategory(name, type, silent) {
  selectedCategory = name;
  document.getElementById("txCategory").value = name;
  document.querySelectorAll(".cat-option").forEach((el) => {
    el.classList.toggle("selected", el.dataset.name === name);
  });
  if (type && !silent) setSegmented(type);
}

function promptNewCategory() {
  const name = prompt("Nama kategori baru:");
  if (!name || !name.trim()) return;
  const icon = prompt("Emoji ikon untuk kategori ini (contoh: 🎁)", "🏷️") || "🏷️";
  saveCustomCategory({ id: name.toLowerCase().replace(/\s+/g, "-"), name: name.trim(), icon });
  renderCategoryPicker();
  selectCategory(name.trim());
  populateFilterCategorySelect();
  showToast(`Kategori "${name.trim()}" ditambahkan.`);
}

// ---------------- FORMAT NOMINAL LIVE ----------------
document.getElementById("txNominal").addEventListener("input", (e) => {
  const raw = e.target.value.replace(/\D/g, "");
  e.target.value = raw ? Number(raw).toLocaleString("id-ID") : "";
});

// ---------------- SUBMIT FORM ----------------
document.getElementById("txForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("txId").value;
  const amount = Number(document.getElementById("txNominal").value.replace(/\D/g, ""));
  const category = document.getElementById("txCategory").value;
  const date = document.getElementById("txDate").value;
  const time = document.getElementById("txTime").value;
  const description = document.getElementById("txDesc").value.trim();
  const btn = document.getElementById("txSubmitBtn");

  if (!amount || amount <= 0) {
    showToast("Nominal harus lebih dari 0.", "error");
    return;
  }
  if (!category) {
    showToast("Silakan pilih kategori.", "error");
    return;
  }

  const payload = {
    uid: currentUid,
    type: selectedType,
    amount,
    category,
    date,
    time,
    description,
  };

  const originalLabel = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;

  try {
    if (id) {
      await db.collection("transactions").doc(id).update(payload);
      showToast("Transaksi berhasil diperbarui.");
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("transactions").add(payload);
      showToast("Transaksi berhasil disimpan.");
    }
    closeSheet();
  } catch (err) {
    console.error(err);
    showToast("Gagal menyimpan transaksi.", "error");
  } finally {
    btn.innerHTML = originalLabel;
    btn.disabled = false;
  }
});

// ---------------- HAPUS TRANSAKSI ----------------
function askDelete(id) {
  pendingDeleteId = id;
  overlay.classList.add("show");
  deleteModal.classList.add("show");
}

document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
  pendingDeleteId = null;
  closeSheet();
});

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  const btn = document.getElementById("confirmDeleteBtn");
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    await db.collection("transactions").doc(pendingDeleteId).delete();
    showToast("Transaksi berhasil dihapus.");
  } catch (err) {
    console.error(err);
    showToast("Gagal menghapus transaksi.", "error");
  } finally {
    btn.innerHTML = "Hapus";
    pendingDeleteId = null;
    closeSheet();
  }
});
