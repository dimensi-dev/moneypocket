/* =========================================================================
   MONEY POCKET — APP LOGIC
   Daftar isi:
   1. Konstanta & State
   2. Utilitas (format rupiah, tanggal, id, storage)
   3. Navigasi antar halaman
   4. Render: Dashboard
   5. Render: Riwayat (grouping, filter, search)
   6. Render: Statistik (Chart.js)
   7. Bottom Sheet: Tambah / Edit Transaksi
   8. Bottom Sheet: Detail Transaksi
   9. Swipe-to-delete & tombol hapus
   10. Modal Konfirmasi (dipakai ulang untuk hapus & reset)
   11. Pengaturan: Saldo, Export/Import, Backup/Restore, Reset
   12. Dark Mode
   13. Toast
   14. Ripple Button Effect
   15. Init & Service Worker
   ========================================================================= */

(() => {
  'use strict';

  /* ----------------------------------------------------------------------
     1. KONSTANTA & STATE
  ---------------------------------------------------------------------- */
  const STORAGE_KEYS = {
    TRANSAKSI: 'mp_transaksi',
    SALDO_AWAL: 'mp_saldo_awal',
    THEME: 'mp_theme',
    BACKUP: 'mp_backup',
  };

  const KATEGORI_LIST = [
    { id: 'makan', label: 'Makan', icon: '🍔' },
    { id: 'minum', label: 'Minum', icon: '☕' },
    { id: 'belanja', label: 'Belanja', icon: '🛒' },
    { id: 'transportasi', label: 'Transportasi', icon: '⛽' },
    { id: 'hiburan', label: 'Hiburan', icon: '🎮' },
    { id: 'kesehatan', label: 'Kesehatan', icon: '💊' },
    { id: 'pendidikan', label: 'Pendidikan', icon: '📚' },
    { id: 'lainnya', label: 'Lainnya', icon: '💼' },
  ];

  const CHART_COLORS = ['#4CAF50', '#22C55E', '#F59E0B', '#3B82F6', '#EF4444', '#A855F7', '#14B8A6', '#EC4899'];

  // State aplikasi di memori, disinkronkan dengan LocalStorage
  let state = {
    transaksi: [],       // { id, nominal, kategori, keterangan, tanggal (YYYY-MM-DD), jam (HH:MM), createdAt }
    saldoAwal: 0,
    activeFilter: 'semua',
    searchQuery: '',
    customRange: { start: null, end: null },
    editingId: null,
    pendingDeleteId: null,
    charts: {},           // instance Chart.js agar bisa di-destroy sebelum re-render
  };

  /* ----------------------------------------------------------------------
     2. UTILITAS
  ---------------------------------------------------------------------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function formatRupiah(angka) {
    const n = Math.round(Number(angka) || 0);
    return 'Rp' + n.toLocaleString('id-ID');
  }

  function parseAngka(str) {
    return Number(String(str).replace(/[^0-9]/g, '')) || 0;
  }

  function generateId() {
    return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function nowHHMM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function formatTanggalPanjang(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatTanggalPendek(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getKategoriMeta(id) {
    return KATEGORI_LIST.find((k) => k.id === id) || KATEGORI_LIST[KATEGORI_LIST.length - 1];
  }

  function saveTransaksi() {
    localStorage.setItem(STORAGE_KEYS.TRANSAKSI, JSON.stringify(state.transaksi));
  }

  function loadTransaksi() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRANSAKSI);
      state.transaksi = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.transaksi = [];
    }
  }

  function saveSaldoAwal() {
    localStorage.setItem(STORAGE_KEYS.SALDO_AWAL, String(state.saldoAwal));
  }

  function loadSaldoAwal() {
    const raw = localStorage.getItem(STORAGE_KEYS.SALDO_AWAL);
    state.saldoAwal = raw ? Number(raw) : 0;
  }

  // Rentang tanggal pembantu
  function startOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay() === 0 ? 7 : date.getDay(); // Senin = 1
    date.setDate(date.getDate() - (day - 1));
    date.setHours(0, 0, 0, 0);
    return date;
  }
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ----------------------------------------------------------------------
     3. NAVIGASI ANTAR HALAMAN
  ---------------------------------------------------------------------- */
  function navigateTo(screenName) {
    $$('.screen').forEach((s) => (s.hidden = s.dataset.screen !== screenName));
    $$('.nav-item').forEach((n) => n.classList.toggle('is-active', n.dataset.nav === screenName));
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    if (screenName === 'riwayat') renderRiwayat();
    if (screenName === 'statistik') renderStatistik();
    if (screenName === 'dashboard') renderDashboard();
  }

  $$('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
  });

  /* ----------------------------------------------------------------------
     4. RENDER: DASHBOARD
  ---------------------------------------------------------------------- */
  function computeTotals() {
    const now = new Date();
    const startWeek = startOfWeek(now);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalPengeluaran = 0, hariIni = 0, mingguIni = 0, bulanIni = 0;

    state.transaksi.forEach((t) => {
      const amount = Number(t.nominal) || 0;
      totalPengeluaran += amount;
      const tDate = new Date(t.tanggal + 'T00:00:00');
      if (isSameDay(tDate, now)) hariIni += amount;
      if (tDate >= startWeek) mingguIni += amount;
      if (tDate >= startMonth) bulanIni += amount;
    });

    const saldo = state.saldoAwal - totalPengeluaran;
    return { saldo, hariIni, mingguIni, bulanIni, totalPengeluaran, jumlah: state.transaksi.length };
  }

  function renderDashboard() {
    const totals = computeTotals();
    $('#stat-saldo').textContent = formatRupiah(totals.saldo);
    $('#stat-hari-ini').textContent = formatRupiah(totals.hariIni);
    $('#stat-minggu-ini').textContent = formatRupiah(totals.mingguIni);
    $('#stat-bulan-ini').textContent = formatRupiah(totals.bulanIni);
    $('#stat-jumlah-transaksi').textContent = String(totals.jumlah);

    const recent = [...state.transaksi]
      .sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam))
      .slice(0, 5);

    const listEl = $('#dashboard-recent-list');
    const emptyEl = $('#dashboard-empty');
    listEl.innerHTML = '';

    if (recent.length === 0) {
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
      recent.forEach((t) => listEl.appendChild(buildTxItem(t, false)));
    }
  }

  /* ----------------------------------------------------------------------
     5. RENDER: RIWAYAT (grouping, filter, search)
  ---------------------------------------------------------------------- */
  function buildTxItem(t, swipeable = true) {
    const meta = getKategoriMeta(t.kategori);
    const item = document.createElement('div');
    item.className = 'tx-item';
    item.dataset.id = t.id;
    item.innerHTML = `
      <div class="tx-item__icon">${meta.icon}</div>
      <div class="tx-item__body">
        <p class="tx-item__title">${escapeHTML(t.keterangan || meta.label)}</p>
        <p class="tx-item__meta">${meta.label} · ${formatTanggalPendek(t.tanggal)} · ${t.jam}</p>
      </div>
      <div class="tx-item__amount">-${formatRupiah(t.nominal)}</div>
      ${swipeable ? `<button class="tx-item__delete" aria-label="Hapus transaksi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/></svg>
      </button>` : ''}
    `;

    // Klik untuk membuka detail (kecuali klik tombol hapus)
    item.addEventListener('click', (e) => {
      if (e.target.closest('.tx-item__delete')) return;
      openDetail(t.id);
    });

    if (swipeable) {
      enableSwipeToDelete(item, t.id);
      item.querySelector('.tx-item__delete').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDelete(t.id);
      });
    }

    return item;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function filterTransaksi() {
    const now = new Date();
    const startWeek = startOfWeek(now);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let list = [...state.transaksi];

    // Filter berdasarkan chip aktif
    switch (state.activeFilter) {
      case 'hari-ini':
        list = list.filter((t) => isSameDay(new Date(t.tanggal + 'T00:00:00'), now));
        break;
      case 'kemarin':
        list = list.filter((t) => isSameDay(new Date(t.tanggal + 'T00:00:00'), yesterday));
        break;
      case 'minggu-ini':
        list = list.filter((t) => new Date(t.tanggal + 'T00:00:00') >= startWeek);
        break;
      case 'bulan-ini':
        list = list.filter((t) => new Date(t.tanggal + 'T00:00:00') >= startMonth);
        break;
      case 'custom':
        if (state.customRange.start && state.customRange.end) {
          list = list.filter((t) => t.tanggal >= state.customRange.start && t.tanggal <= state.customRange.end);
        }
        break;
      default:
        break; // 'semua'
    }

    // Filter pencarian
    const q = state.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const meta = getKategoriMeta(t.kategori);
        return (
          meta.label.toLowerCase().includes(q) ||
          (t.keterangan || '').toLowerCase().includes(q) ||
          String(t.nominal).includes(q)
        );
      });
    }

    return list.sort((a, b) => (b.tanggal + b.jam).localeCompare(a.tanggal + a.jam));
  }

  function groupLabelFor(iso) {
    const now = new Date();
    const d = new Date(iso + 'T00:00:00');
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(d, now)) return 'Hari Ini';
    if (isSameDay(d, yesterday)) return 'Kemarin';
    return formatTanggalPanjang(iso);
  }

  function renderRiwayat() {
    const list = filterTransaksi();
    const container = $('#riwayat-list');
    const emptyEl = $('#riwayat-empty');
    container.innerHTML = '';

    if (list.length === 0) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    // Kelompokkan per tanggal
    let lastLabel = null;
    list.forEach((t) => {
      const label = groupLabelFor(t.tanggal);
      if (label !== lastLabel) {
        const groupEl = document.createElement('p');
        groupEl.className = 'group-label';
        groupEl.textContent = label;
        container.appendChild(groupEl);
        lastLabel = label;
      }
      container.appendChild(buildTxItem(t, true));
    });
  }

  // Chip filter
  $$('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      $$('.chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.activeFilter = chip.dataset.filter;
      $('#custom-range').hidden = state.activeFilter !== 'custom';
      renderRiwayat();
    });
  });

  $('#btn-apply-range').addEventListener('click', () => {
    state.customRange.start = $('#range-start').value || null;
    state.customRange.end = $('#range-end').value || null;
    renderRiwayat();
  });

  // Search bar (debounced ringan)
  let searchTimer = null;
  $('#search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value;
    searchTimer = setTimeout(() => {
      state.searchQuery = val;
      renderRiwayat();
    }, 150);
  });

  /* ----------------------------------------------------------------------
     9. SWIPE-TO-DELETE
  ---------------------------------------------------------------------- */
  function enableSwipeToDelete(item, id) {
    let startX = 0, currentX = 0, isSwiping = false;

    item.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isSwiping = true;
    }, { passive: true });

    item.addEventListener('touchmove', (e) => {
      if (!isSwiping) return;
      currentX = e.touches[0].clientX - startX;
      if (currentX < -20) item.classList.add('is-swiped');
      else if (currentX > 10) item.classList.remove('is-swiped');
    }, { passive: true });

    item.addEventListener('touchend', () => { isSwiping = false; });
  }

  /* ----------------------------------------------------------------------
     6. RENDER: STATISTIK (Chart.js)
  ---------------------------------------------------------------------- */
  function destroyChart(key) {
    if (state.charts[key]) {
      state.charts[key].destroy();
      state.charts[key] = null;
    }
  }

  function getFontColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#1F2937';
  }

  function renderStatistik() {
    renderChartKategori();
    renderChartMingguan();
    renderChartBulanan();
  }

  function renderChartKategori() {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dataMap = {};

    state.transaksi.forEach((t) => {
      const tDate = new Date(t.tanggal + 'T00:00:00');
      if (tDate < startMonth) return;
      dataMap[t.kategori] = (dataMap[t.kategori] || 0) + Number(t.nominal);
    });

    const entries = Object.entries(dataMap).sort((a, b) => b[1] - a[1]);
    const pieEmpty = $('#pie-empty');
    const canvas = $('#chart-kategori');
    const legend = $('#chart-kategori-legend');
    legend.innerHTML = '';

    destroyChart('kategori');

    if (entries.length === 0) {
      pieEmpty.hidden = false;
      canvas.style.display = 'none';
      return;
    }
    pieEmpty.hidden = true;
    canvas.style.display = 'block';

    const labels = entries.map(([id]) => getKategoriMeta(id).label);
    const values = entries.map(([, v]) => v);
    const colors = entries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

    state.charts.kategori = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false } },
      },
    });

    entries.forEach(([id, val], i) => {
      const li = document.createElement('div');
      li.className = 'legend__item';
      li.innerHTML = `<span class="legend__dot" style="background:${colors[i]}"></span> ${getKategoriMeta(id).label} · ${formatRupiah(val)}`;
      legend.appendChild(li);
    });
  }

  function renderChartMingguan() {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const labels = days.map((d) => d.toLocaleDateString('id-ID', { weekday: 'short' }));
    const values = days.map((d) => {
      const iso = d.toISOString().slice(0, 10);
      return state.transaksi.filter((t) => t.tanggal === iso).reduce((sum, t) => sum + Number(t.nominal), 0);
    });

    destroyChart('mingguan');
    const fontColor = getFontColor();
    state.charts.mingguan = new Chart($('#chart-mingguan').getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ data: values, backgroundColor: '#4CAF50', borderRadius: 8, maxBarThickness: 28 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: fontColor, font: { size: 11 } } },
          y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: fontColor, font: { size: 10 }, callback: (v) => v >= 1000 ? (v / 1000) + 'k' : v } },
        },
      },
    });
  }

  function renderChartBulanan() {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d);
    }
    const labels = months.map((d) => d.toLocaleDateString('id-ID', { month: 'short' }));
    const values = months.map((d) => {
      return state.transaksi
        .filter((t) => {
          const td = new Date(t.tanggal + 'T00:00:00');
          return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
        })
        .reduce((sum, t) => sum + Number(t.nominal), 0);
    });

    destroyChart('bulanan');
    const fontColor = getFontColor();
    state.charts.bulanan = new Chart($('#chart-bulanan').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values, borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.12)',
          tension: 0.35, fill: true, pointRadius: 3, pointBackgroundColor: '#4CAF50',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: fontColor, font: { size: 11 } } },
          y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: fontColor, font: { size: 10 }, callback: (v) => v >= 1000 ? (v / 1000) + 'k' : v } },
        },
      },
    });
  }

  /* ----------------------------------------------------------------------
     7. BOTTOM SHEET: TAMBAH / EDIT TRANSAKSI
  ---------------------------------------------------------------------- */
  const sheetOverlay = $('#sheet-overlay');
  const sheetTransaksi = $('#sheet-transaksi');

  function buildCategoryGrid() {
    const grid = $('#category-grid');
    grid.innerHTML = '';
    KATEGORI_LIST.forEach((k) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'category-chip';
      btn.dataset.id = k.id;
      btn.innerHTML = `<span class="category-chip__icon">${k.icon}</span><span>${k.label}</span>`;
      btn.addEventListener('click', () => {
        $$('.category-chip').forEach((c) => c.classList.remove('is-active'));
        btn.classList.add('is-active');
        $('#input-kategori').value = k.id;
      });
      grid.appendChild(btn);
    });
  }
  buildCategoryGrid();

  function openSheetTambah() {
    state.editingId = null;
    $('#sheet-title').textContent = 'Tambah Pengeluaran';
    $('#form-transaksi').reset();
    $('#input-id').value = '';
    $('#input-kategori').value = '';
    $$('.category-chip').forEach((c) => c.classList.remove('is-active'));
    $('#input-tanggal').value = todayISO();
    $('#input-jam').value = nowHHMM();
    openSheet(sheetTransaksi, sheetOverlay);
  }

  function openSheetEdit(id) {
    const t = state.transaksi.find((x) => x.id === id);
    if (!t) return;
    state.editingId = id;
    $('#sheet-title').textContent = 'Edit Pengeluaran';
    $('#input-id').value = t.id;
    $('#input-nominal').value = formatRupiah(t.nominal).replace('Rp', '');
    $('#input-kategori').value = t.kategori;
    $$('.category-chip').forEach((c) => c.classList.toggle('is-active', c.dataset.id === t.kategori));
    $('#input-keterangan').value = t.keterangan || '';
    $('#input-tanggal').value = t.tanggal;
    $('#input-jam').value = t.jam;
    openSheet(sheetTransaksi, sheetOverlay);
  }

  function openSheet(sheetEl, overlayEl) {
    overlayEl.classList.add('is-open');
    sheetEl.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet(sheetEl, overlayEl) {
    overlayEl.classList.remove('is-open');
    sheetEl.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  $('#fab-add').addEventListener('click', openSheetTambah);
  $('#btn-close-sheet').addEventListener('click', () => closeSheet(sheetTransaksi, sheetOverlay));
  $('#btn-cancel-sheet').addEventListener('click', () => closeSheet(sheetTransaksi, sheetOverlay));
  sheetOverlay.addEventListener('click', () => {
    closeSheet(sheetTransaksi, sheetOverlay);
    closeSheet($('#sheet-detail'), $('#detail-overlay'));
  });

  // Format live nominal input dengan pemisah ribuan
  $('#input-nominal').addEventListener('input', (e) => {
    const angka = parseAngka(e.target.value);
    e.target.value = angka ? angka.toLocaleString('id-ID') : '';
  });
  $('#input-saldo-awal').addEventListener('input', (e) => {
    const angka = parseAngka(e.target.value);
    e.target.value = angka ? angka.toLocaleString('id-ID') : '';
  });

  $('#form-transaksi').addEventListener('submit', (e) => {
    e.preventDefault();
    const nominal = parseAngka($('#input-nominal').value);
    const kategori = $('#input-kategori').value;
    const keterangan = $('#input-keterangan').value.trim();
    const tanggal = $('#input-tanggal').value;
    const jam = $('#input-jam').value;

    if (!nominal) return showToast('Nominal belum diisi.', 'danger');
    if (!kategori) return showToast('Pilih kategori terlebih dahulu.', 'danger');
    if (!tanggal || !jam) return showToast('Tanggal dan jam wajib diisi.', 'danger');

    if (state.editingId) {
      const idx = state.transaksi.findIndex((t) => t.id === state.editingId);
      if (idx > -1) {
        state.transaksi[idx] = { ...state.transaksi[idx], nominal, kategori, keterangan, tanggal, jam };
      }
      showToast('Perubahan berhasil disimpan.', 'success');
    } else {
      state.transaksi.push({
        id: generateId(), nominal, kategori, keterangan, tanggal, jam, createdAt: Date.now(),
      });
      showToast('Pengeluaran berhasil ditambahkan.', 'success');
    }

    saveTransaksi();
    closeSheet(sheetTransaksi, sheetOverlay);
    refreshAllScreens();
  });

  /* ----------------------------------------------------------------------
     8. BOTTOM SHEET: DETAIL TRANSAKSI
  ---------------------------------------------------------------------- */
  const sheetDetail = $('#sheet-detail');
  const detailOverlay = $('#detail-overlay');
  let currentDetailId = null;

  function openDetail(id) {
    const t = state.transaksi.find((x) => x.id === id);
    if (!t) return;
    currentDetailId = id;
    const meta = getKategoriMeta(t.kategori);
    $('#detail-body').innerHTML = `
      <div class="detail-amount">
        <div class="detail-amount__icon">${meta.icon}</div>
        <div class="detail-amount__value">-${formatRupiah(t.nominal)}</div>
      </div>
      <div class="detail-row"><span class="detail-row__label">Kategori</span><span class="detail-row__value">${meta.label}</span></div>
      <div class="detail-row"><span class="detail-row__label">Keterangan</span><span class="detail-row__value">${escapeHTML(t.keterangan) || '-'}</span></div>
      <div class="detail-row"><span class="detail-row__label">Tanggal</span><span class="detail-row__value">${formatTanggalPanjang(t.tanggal)}</span></div>
      <div class="detail-row"><span class="detail-row__label">Jam</span><span class="detail-row__value">${t.jam}</span></div>
    `;
    openSheet(sheetDetail, detailOverlay);
  }

  $('#btn-close-detail').addEventListener('click', () => closeSheet(sheetDetail, detailOverlay));
  $('#btn-detail-edit').addEventListener('click', () => {
    closeSheet(sheetDetail, detailOverlay);
    openSheetEdit(currentDetailId);
  });
  $('#btn-detail-hapus').addEventListener('click', () => {
    closeSheet(sheetDetail, detailOverlay);
    confirmDelete(currentDetailId);
  });

  /* ----------------------------------------------------------------------
     10. MODAL KONFIRMASI
  ---------------------------------------------------------------------- */
  const confirmOverlay = $('#confirm-overlay');
  let confirmCallback = null;

  function openConfirm({ icon = '⚠️', title, desc, onConfirm }) {
    $('#confirm-icon').textContent = icon;
    $('#confirm-title').textContent = title;
    $('#confirm-desc').textContent = desc;
    confirmCallback = onConfirm;
    confirmOverlay.classList.add('is-open');
  }
  function closeConfirm() {
    confirmOverlay.classList.remove('is-open');
    confirmCallback = null;
  }
  $('#confirm-cancel').addEventListener('click', closeConfirm);
  $('#confirm-ok').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
  });

  function confirmDelete(id) {
    openConfirm({
      icon: '🗑️',
      title: 'Hapus transaksi ini?',
      desc: 'Data yang dihapus tidak dapat dikembalikan.',
      onConfirm: () => {
        state.transaksi = state.transaksi.filter((t) => t.id !== id);
        saveTransaksi();
        showToast('Transaksi berhasil dihapus.', 'success');
        refreshAllScreens();
      },
    });
  }

  /* ----------------------------------------------------------------------
     11. PENGATURAN: SALDO, EXPORT/IMPORT, BACKUP/RESTORE, RESET
  ---------------------------------------------------------------------- */
  function fillSettingsScreen() {
    $('#input-saldo-awal').value = state.saldoAwal ? state.saldoAwal.toLocaleString('id-ID') : '';
    const backupRaw = localStorage.getItem(STORAGE_KEYS.BACKUP);
    if (backupRaw) {
      try {
        const backup = JSON.parse(backupRaw);
        $('#backup-info').textContent = `Backup terakhir: ${new Date(backup.savedAt).toLocaleString('id-ID')}`;
      } catch (e) { /* abaikan */ }
    }
  }

  $('#btn-save-saldo').addEventListener('click', () => {
    state.saldoAwal = parseAngka($('#input-saldo-awal').value);
    saveSaldoAwal();
    showToast('Saldo awal berhasil disimpan.', 'success');
    renderDashboard();
  });

  // Export JSON — unduh seluruh data sebagai file
  $('#btn-export').addEventListener('click', () => {
    const payload = { transaksi: state.transaksi, saldoAwal: state.saldoAwal, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money-pocket-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Data berhasil diexport.', 'success');
  });

  // Import JSON
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        openConfirm({
          icon: '⬆️',
          title: 'Import data ini?',
          desc: 'Data yang ada saat ini akan digantikan dengan data dari file.',
          onConfirm: () => {
            state.transaksi = Array.isArray(data.transaksi) ? data.transaksi : [];
            state.saldoAwal = Number(data.saldoAwal) || 0;
            saveTransaksi();
            saveSaldoAwal();
            fillSettingsScreen();
            refreshAllScreens();
            showToast('Data berhasil diimport.', 'success');
          },
        });
      } catch (err) {
        showToast('File tidak valid.', 'danger');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Backup ke LocalStorage terpisah
  $('#btn-backup').addEventListener('click', () => {
    const payload = { transaksi: state.transaksi, saldoAwal: state.saldoAwal, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEYS.BACKUP, JSON.stringify(payload));
    fillSettingsScreen();
    showToast('Backup berhasil disimpan.', 'success');
  });

  // Restore dari backup LocalStorage
  $('#btn-restore').addEventListener('click', () => {
    const raw = localStorage.getItem(STORAGE_KEYS.BACKUP);
    if (!raw) return showToast('Belum ada backup tersimpan.', 'danger');
    openConfirm({
      icon: '♻️',
      title: 'Restore dari backup?',
      desc: 'Data saat ini akan digantikan dengan data backup terakhir.',
      onConfirm: () => {
        const backup = JSON.parse(raw);
        state.transaksi = backup.transaksi || [];
        state.saldoAwal = Number(backup.saldoAwal) || 0;
        saveTransaksi();
        saveSaldoAwal();
        fillSettingsScreen();
        refreshAllScreens();
        showToast('Data berhasil direstore.', 'success');
      },
    });
  });

  // Reset semua data
  $('#btn-reset').addEventListener('click', () => {
    openConfirm({
      icon: '🗑️',
      title: 'Reset semua data?',
      desc: 'Seluruh transaksi dan saldo akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
      onConfirm: () => {
        state.transaksi = [];
        state.saldoAwal = 0;
        saveTransaksi();
        saveSaldoAwal();
        fillSettingsScreen();
        refreshAllScreens();
        showToast('Semua data berhasil direset.', 'success');
      },
    });
  });

  /* ----------------------------------------------------------------------
     12. DARK MODE
  ---------------------------------------------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    $('#toggle-dark-mode').checked = theme === 'dark';
    // Refresh chart warna font jika sedang di halaman statistik
    if (!$('#screen-statistik').hidden) renderStatistik();
  }

  function loadTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
  }

  $('#btn-theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  $('#toggle-dark-mode').addEventListener('change', (e) => {
    applyTheme(e.target.checked ? 'dark' : 'light');
  });

  /* ----------------------------------------------------------------------
     13. TOAST
  ---------------------------------------------------------------------- */
  let toastTimer = null;
  function showToast(message, type = 'default') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = 'toast is-visible' + (type === 'danger' ? ' is-danger' : type === 'success' ? ' is-success' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  /* ----------------------------------------------------------------------
     14. RIPPLE BUTTON EFFECT
  ---------------------------------------------------------------------- */
  $$('.btn').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 550);
    });
  });

  /* ----------------------------------------------------------------------
     REFRESH SEMUA LAYAR YANG SEDANG AKTIF
  ---------------------------------------------------------------------- */
  function refreshAllScreens() {
    renderDashboard();
    if (!$('#screen-riwayat').hidden) renderRiwayat();
    if (!$('#screen-statistik').hidden) renderStatistik();
  }

  /* ----------------------------------------------------------------------
     15. INIT & SERVICE WORKER
  ---------------------------------------------------------------------- */
  function init() {
    loadTransaksi();
    loadSaldoAwal();
    loadTheme();
    fillSettingsScreen();
    renderDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {
        /* gagal daftar service worker, aplikasi tetap berjalan online */
      });
    });
  }
})();
