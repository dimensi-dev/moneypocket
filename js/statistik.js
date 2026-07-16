// ====================================================
// STATISTIK.JS — Pie, Bar, dan Line chart menggunakan Chart.js
// ====================================================

let statUid = null;
let statTransactions = [];
let statRange = "bulan-ini";

let pieChartInstance = null;
let barChartInstance = null;
let lineChartInstance = null;

const CHART_PALETTE = [
  "#22c55e", "#0ea5e9", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1",
];

document.addEventListener("authReady", (e) => {
  const user = e.detail.user;
  if (!user || !document.getElementById("pieChart")) return;
  statUid = user.uid;

  db.collection("transactions")
    .where("uid", "==", statUid)
    .onSnapshot(
      (snapshot) => {
        statTransactions = [];
        snapshot.forEach((doc) => statTransactions.push({ id: doc.id, ...doc.data() }));
        renderAllCharts();
      },
      (err) => {
        console.error(err);
        showToast("Gagal memuat data statistik.", "error");
      }
    );
});

document.getElementById("statRangeChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  document.querySelectorAll("#statRangeChips .filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  statRange = chip.dataset.range;
  renderAllCharts();
});

function filterByStatRange(items) {
  const now = new Date();
  return items.filter((t) => {
    const d = new Date(t.date);
    if (statRange === "semua") return true;
    if (statRange === "bulan-ini") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (statRange === "bulan-lalu") {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear();
    }
    if (statRange === "7-hari") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return d >= start;
    }
    return true;
  });
}

function getThemeColors() {
  const dark = document.body.classList.contains("dark-mode");
  return {
    text: dark ? "#a4aeaa" : "#6b7280",
    grid: dark ? "#24302a" : "#eef1ef",
  };
}

function renderAllCharts() {
  const items = filterByStatRange(statTransactions);
  renderPieChart(items);
  renderBarChart(items);
  renderLineChart(statTransactions); // line saldo pakai seluruh histori agar akurat
}

// ---------------- PIE: kategori pengeluaran ----------------
function renderPieChart(items) {
  const expenses = items.filter((t) => t.type === "pengeluaran");
  const byCategory = {};
  expenses.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount || 0);
  });

  const labels = Object.keys(byCategory);
  const data = Object.values(byCategory);
  const colors = labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);

  const ctx = document.getElementById("pieChart").getContext("2d");
  if (pieChartInstance) pieChartInstance.destroy();

  const legendEl = document.getElementById("pieLegend");

  if (labels.length === 0) {
    legendEl.innerHTML = `<div class="empty-state" style="padding:var(--space-4);"><p>Belum ada data pengeluaran pada periode ini.</p></div>`;
    return;
  }

  pieChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatRupiah(c.raw) } } },
    },
  });

  const total = data.reduce((a, b) => a + b, 0);
  legendEl.innerHTML = labels
    .map((label, i) => {
      const pct = total ? Math.round((data[i] / total) * 100) : 0;
      return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[i]}"></span>
        <span class="legend-name">${label}</span>
        <span class="legend-val">${formatRupiah(data[i])} (${pct}%)</span>
      </div>`;
    })
    .join("");
}

// ---------------- BAR: pengeluaran per minggu ----------------
function getWeekLabel(date) {
  const start = new Date(date);
  const day = start.getDay() === 0 ? 7 : start.getDay();
  start.setDate(start.getDate() - (day - 1));
  return start.toISOString().split("T")[0];
}

function renderBarChart(items) {
  const expenses = items.filter((t) => t.type === "pengeluaran");
  const byWeek = {};
  expenses.forEach((t) => {
    const wk = getWeekLabel(new Date(t.date));
    byWeek[wk] = (byWeek[wk] || 0) + Number(t.amount || 0);
  });

  const weeks = Object.keys(byWeek).sort();
  const labels = weeks.map((w) => "Mgg " + new Date(w).toLocaleDateString("id-ID", { day: "numeric", month: "short" }));
  const data = weeks.map((w) => byWeek[w]);

  const ctx = document.getElementById("barChart").getContext("2d");
  if (barChartInstance) barChartInstance.destroy();
  const theme = getThemeColors();

  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Pengeluaran",
          data,
          backgroundColor: "#22c55e",
          borderRadius: 8,
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => formatRupiah(c.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { family: "Poppins", size: 10 } } },
        y: {
          grid: { color: theme.grid },
          ticks: {
            color: theme.text,
            font: { family: "Poppins", size: 10 },
            callback: (v) => (v >= 1000 ? v / 1000 + "k" : v),
          },
        },
      },
    },
  });
}

// ---------------- LINE: saldo harian ----------------
function renderLineChart(allItems) {
  const sorted = [...allItems].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sorted.length === 0) {
    const ctx = document.getElementById("lineChart").getContext("2d");
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{ data: [] }] },
      options: { responsive: true, maintainAspectRatio: false },
    });
    return;
  }

  // Hitung saldo kumulatif per tanggal (30 hari terakhir untuk keterbacaan)
  const byDate = {};
  sorted.forEach((t) => {
    const amount = Number(t.amount || 0);
    byDate[t.date] = (byDate[t.date] || 0) + (t.type === "pemasukan" ? amount : -amount);
  });

  const allDates = Object.keys(byDate).sort();
  let running = 0;
  const cumulative = {};
  allDates.forEach((d) => {
    running += byDate[d];
    cumulative[d] = running;
  });

  const shownDates = allDates.slice(-30);
  const labels = shownDates.map((d) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" }));
  const data = shownDates.map((d) => cumulative[d]);

  const ctx = document.getElementById("lineChart").getContext("2d");
  if (lineChartInstance) lineChartInstance.destroy();
  const theme = getThemeColors();

  lineChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Saldo",
          data,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => formatRupiah(c.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.text, font: { family: "Poppins", size: 9 }, maxTicksLimit: 6 } },
        y: {
          grid: { color: theme.grid },
          ticks: {
            color: theme.text,
            font: { family: "Poppins", size: 10 },
            callback: (v) => (Math.abs(v) >= 1000 ? v / 1000 + "k" : v),
          },
        },
      },
    },
  });
}
