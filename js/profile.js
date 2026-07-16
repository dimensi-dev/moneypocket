// ====================================================
// PROFILE.JS — Profil pengguna, statistik, dan pengaturan
// (dark mode, export CSV/PDF, import data, reset data)
// ====================================================

let profileUid = null;
let profileTransactions = [];

const overlay = document.getElementById("overlay");
const resetModal = document.getElementById("resetModal");

document.addEventListener("authReady", (e) => {
  const user = e.detail.user;
  if (!user || !document.getElementById("profileName")) return;
  profileUid = user.uid;

  document.getElementById("profileName").textContent = user.displayName || "Pengguna DompetKu";
  document.getElementById("profileEmail").textContent = user.email;

  db.collection("users")
    .doc(user.uid)
    .get()
    .then((doc) => {
      if (doc.exists && doc.data().createdAt) {
        const created = doc.data().createdAt.toDate();
        document.getElementById("joinDate").textContent = created.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } else {
        document.getElementById("joinDate").textContent = "-";
      }
    });

  db.collection("transactions")
    .where("uid", "==", user.uid)
    .onSnapshot((snapshot) => {
      profileTransactions = [];
      snapshot.forEach((doc) => profileTransactions.push({ id: doc.id, ...doc.data() }));
      renderProfileStats();
    });

  // Set toggle sesuai preferensi tersimpan
  const darkToggle = document.getElementById("darkModeToggle");
  darkToggle.checked = document.body.classList.contains("dark-mode");
});

function renderProfileStats() {
  let income = 0,
    expense = 0;
  profileTransactions.forEach((t) => {
    if (t.type === "pemasukan") income += Number(t.amount || 0);
    else expense += Number(t.amount || 0);
  });
  document.getElementById("statCount").textContent = profileTransactions.length;
  document.getElementById("statIncome").textContent = formatRupiah(income);
  document.getElementById("statExpense").textContent = formatRupiah(expense);
}

// ---------------- DARK MODE ----------------
document.getElementById("darkModeToggle").addEventListener("change", (e) => {
  toggleDarkMode(e.target.checked);
});

// ---------------- EXPORT CSV ----------------
document.getElementById("exportCsvBtn").addEventListener("click", () => {
  if (profileTransactions.length === 0) {
    showToast("Belum ada transaksi untuk diekspor.", "error");
    return;
  }
  const header = ["Tanggal", "Jam", "Jenis", "Kategori", "Nominal", "Keterangan"];
  const rows = profileTransactions.map((t) => [
    t.date,
    t.time,
    t.type,
    t.category,
    t.amount,
    (t.description || "").replace(/,/g, ";"),
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  downloadFile(csv, `dompetku-transaksi-${todayISO()}.csv`, "text/csv;charset=utf-8;");
  showToast("Data berhasil diekspor ke CSV.");
});

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------- EXPORT PDF (via dialog cetak browser) ----------------
document.getElementById("exportPdfBtn").addEventListener("click", () => {
  if (profileTransactions.length === 0) {
    showToast("Belum ada transaksi untuk diekspor.", "error");
    return;
  }
  const sorted = [...profileTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const rowsHtml = sorted
    .map(
      (t) => `
      <tr>
        <td>${formatTanggalPendek(t.date)}</td>
        <td>${t.time || "-"}</td>
        <td>${t.category}</td>
        <td>${t.type === "pemasukan" ? "Pemasukan" : "Pengeluaran"}</td>
        <td style="text-align:right;">${formatRupiah(t.amount)}</td>
      </tr>`
    )
    .join("");

  const win = window.open("", "_blank");
  win.document.write(`
    <html>
    <head>
      <title>Riwayat Transaksi — DompetKu</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #14181a; }
        h1 { color: #16a34a; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; text-align: left; }
        th { background: #f0fdf4; color: #16a34a; }
      </style>
    </head>
    <body>
      <h1>DompetKu</h1>
      <p>Riwayat Transaksi — dicetak pada ${formatTanggalPanjang(new Date())}</p>
      <table>
        <thead><tr><th>Tanggal</th><th>Jam</th><th>Kategori</th><th>Jenis</th><th>Nominal</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 400);
});

// ---------------- IMPORT DATA (CSV) ----------------
document.getElementById("importFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const lines = text.trim().split("\n");
  lines.shift(); // buang header

  if (lines.length === 0) {
    showToast("File CSV kosong.", "error");
    return;
  }

  showToast(`Mengimpor ${lines.length} transaksi...`);
  const batch = db.batch();
  let count = 0;

  lines.forEach((line) => {
    const cols = line.split(",");
    if (cols.length < 5) return;
    const [date, time, type, category, amount, ...descParts] = cols;
    if (!date || !type || !amount) return;

    const ref = db.collection("transactions").doc();
    batch.set(ref, {
      uid: profileUid,
      date: date.trim(),
      time: (time || "00:00").trim(),
      type: type.trim() === "pemasukan" ? "pemasukan" : "pengeluaran",
      category: (category || "Lainnya").trim(),
      amount: Number(amount) || 0,
      description: descParts.join(",").trim(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  });

  try {
    await batch.commit();
    showToast(`${count} transaksi berhasil diimpor.`);
  } catch (err) {
    console.error(err);
    showToast("Gagal mengimpor data.", "error");
  }
  e.target.value = "";
});

// ---------------- RESET SEMUA DATA ----------------
document.getElementById("resetDataBtn").addEventListener("click", () => {
  overlay.classList.add("show");
  resetModal.classList.add("show");
});

document.getElementById("cancelResetBtn").addEventListener("click", () => {
  overlay.classList.remove("show");
  resetModal.classList.remove("show");
});

document.getElementById("confirmResetBtn").addEventListener("click", async () => {
  const btn = document.getElementById("confirmResetBtn");
  btn.innerHTML = '<span class="spinner"></span>';
  try {
    const batch = db.batch();
    profileTransactions.forEach((t) => {
      batch.delete(db.collection("transactions").doc(t.id));
    });
    await batch.commit();
    showToast("Semua data berhasil direset.");
  } catch (err) {
    console.error(err);
    showToast("Gagal mereset data.", "error");
  } finally {
    btn.innerHTML = "Reset";
    overlay.classList.remove("show");
    resetModal.classList.remove("show");
  }
});
