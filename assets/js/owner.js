/**
 * ============================================================================
 * PENGENDALI ANTARMUKA OWNER & KASIR (owner.js)
 * ============================================================================
 * PENJELASAN MODUL:
 * File ini mengatur antarmuka khusus pemilik barbershop:
 * 1. initDashboard()               : Dasbor 5 metrik utama hari ini & aktivitas kasir.
 * 2. initBookingsManagement()      : Manajemen antrean & status seluruh pemesanan.
 * 3. initPaymentsManagement()      : Verifikasi pembayaran Cash, QRIS, & VA.
 * 4. initServicesManagement()      : Manajemen data master layanan & tarif harga.
 * 5. initKapstersManagement()      : Manajemen data master kapster & keahlian.
 * 6. initRedemptionsManagement()   : Persetujuan / penolakan klaim hadiah member.
 * 7. initMonthlyFinancialReport()  : Laporan keuangan bulanan & grafik batang omset harian.
 * ============================================================================
 */

import {
  Storage,
  STORAGE_KEYS,
  Auth,
  formatRupiah,
  formatDate,
  showToast
} from './common.js';

import {
  Booking,
  BOOKING_STATUS,
  Payment,
  PAYMENT_STATUS,
  Rewards
} from './customer.js';

export const OwnerApp = {
  checkAuth() {
    return Auth.requireOwner('/pages/owner/login.html');
  },

  /**
   * REVISI 5: Dasbor Owner
   * Hanya menampilkan 5 statistik hari ini dan tabel aktivitas pemesanan hari ini.
   */
  initDashboard() {
    if (!this.checkAuth()) return;

    // Tanggal hari ini format YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];

    const bookings = Booking.getAll();
    const redemptions = Rewards.getRedemptions();

    // Filter pemesanan hari ini
    const todayBookings = bookings.filter(b => b.date === today);

    // 1. Total Booking Hari Ini
    const totalToday = todayBookings.length;

    // 2. Booking Selesai Hari Ini
    const completedToday = todayBookings.filter(b => b.bookingStatus === BOOKING_STATUS.COMPLETED).length;

    // 3. Booking Menunggu Pembayaran Hari Ini
    const pendingPaymentToday = todayBookings.filter(b => b.paymentStatus === PAYMENT_STATUS.PENDING).length;

    // 4. Pendapatan Hari Ini (Hanya status Success)
    const revenueToday = todayBookings
      .filter(b => b.paymentStatus === PAYMENT_STATUS.SUCCESS)
      .reduce((sum, b) => sum + (Number(b.servicePrice) || 0), 0);

    // 5. Permintaan Penukaran Reward yang Menunggu Persetujuan (Pending)
    const pendingRedemptions = redemptions.filter(r => r.status === 'Pending').length;

    // Bind statistik ke elemen DOM
    const stat1 = document.getElementById('stat-today-total');
    const stat2 = document.getElementById('stat-today-completed');
    const stat3 = document.getElementById('stat-today-pending-pay');
    const stat4 = document.getElementById('stat-today-revenue');
    const stat5 = document.getElementById('stat-pending-rewards');

    if (stat1) stat1.textContent = totalToday;
    if (stat2) stat2.textContent = completedToday;
    if (stat3) stat3.textContent = pendingPaymentToday;
    if (stat4) stat4.textContent = formatRupiah(revenueToday);
    if (stat5) stat5.textContent = pendingRedemptions;

    // Tabel Aktivitas Booking Hari Ini
    const tbody = document.getElementById('today-bookings-tbody');
    if (tbody) {
      if (todayBookings.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">
              Belum ada aktivitas pemesanan untuk hari ini (${formatDate(today)}).
            </td>
          </tr>
        `;
      } else {
        // Urutkan berdasarkan jam booking
        todayBookings.sort((a, b) => a.time.localeCompare(b.time));

        tbody.innerHTML = todayBookings.map(b => `
          <tr>
            <td><strong class="tabular" style="font-size:1rem;color:var(--color-accent);">${b.time} WIB</strong></td>
            <td>
              <div style="font-weight:700;">${b.customerName}</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">${b.customerType} · ${b.customerPhone}</div>
            </td>
            <td>
              <div style="font-weight:600;">${b.serviceName}</div>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">${formatRupiah(b.servicePrice)}</div>
            </td>
            <td><strong>${b.kapsterName}</strong></td>
            <td>
              <span class="status-badge status-${b.bookingStatus.toLowerCase()}">${b.bookingStatus}</span>
            </td>
            <td>
              <div class="row-actions">
                ${b.paymentStatus === 'Pending' ? `
                  <button type="button" class="btn btn-success btn-sm btn-confirm-pay" data-id="${b.id}" title="Terima Bayar">
                    ✓ Bayar
                  </button>
                ` : `
                  <span style="font-size:0.75rem;color:var(--color-success);font-weight:600;">✓ Lunas</span>
                `}
              </div>
            </td>
          </tr>
        `).join('');

        this.bindPaymentConfirmButtons();
      }
    }
  },

  bindPaymentConfirmButtons() {
    document.querySelectorAll('.btn-confirm-pay').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const res = Payment.confirmPayment(id, 'owner_dashboard');
        if (res.success) {
          showToast(`Pembayaran #${res.booking.bookingCode} berhasil dikonfirmasi Lunas!`, 'success');
          if (res.loyalty && res.loyalty.success) {
            showToast(`+${res.loyalty.pointsAwarded} Poin Loyalitas diberikan ke Member ${res.booking.customerName}.`, 'success');
          }
          setTimeout(() => window.location.reload(), 500);
        } else {
          showToast(res.message, 'error');
        }
      });
    });
  },

  /**
   * REVISI 6: Laporan Keuangan Bulanan
   * Filter Bulan & Tahun, Total Booking Bulanan, Pendapatan Bulanan, dan Grafik Pendapatan Harian.
   */
  initMonthlyFinancialReport() {
    if (!this.checkAuth()) return;

    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');

    // Populate Year options
    const currentYear = new Date().getFullYear();
    if (yearSelect && yearSelect.options.length <= 1) {
      yearSelect.innerHTML = `
        <option value="${currentYear}">${currentYear}</option>
        <option value="${currentYear - 1}">${currentYear - 1}</option>
      `;
    }

    // Default ke bulan & tahun saat ini
    const now = new Date();
    if (monthSelect) monthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
    if (yearSelect) yearSelect.value = String(now.getFullYear());

    const updateReport = () => {
      const selectedMonth = monthSelect.value; // e.g. "11"
      const selectedYear = yearSelect.value;   // e.g. "2026"

      const bookings = Booking.getAll();

      // Filter pemesanan dalam bulan dan tahun yang dipilih berdasarkan tanggal booking (b.date)
      const monthlyBookings = bookings.filter(b => {
        if (!b.date) return false;
        const [y, m] = b.date.split('-');
        return y === selectedYear && m === selectedMonth;
      });

      // B. Total Booking Bulanan
      const totalBookingsCount = monthlyBookings.length;

      // C. Pendapatan Bulanan (Hanya transaksi dengan paymentStatus === 'Success')
      const successfulBookings = monthlyBookings.filter(b => b.paymentStatus === PAYMENT_STATUS.SUCCESS);
      const totalRevenue = successfulBookings.reduce((sum, b) => sum + (Number(b.servicePrice) || 0), 0);

      const countEl = document.getElementById('report-monthly-total-bookings');
      const revEl = document.getElementById('report-monthly-total-revenue');

      if (countEl) countEl.textContent = `${totalBookingsCount} Pemesanan`;
      if (revEl) revEl.textContent = formatRupiah(totalRevenue);

      // D. Grafik Pendapatan Bulanan Berdasarkan Tanggal
      this.renderMonthlyRevenueChart(selectedYear, selectedMonth, successfulBookings);
    };

    monthSelect?.addEventListener('change', updateReport);
    yearSelect?.addEventListener('change', updateReport);

    updateReport();
  },

  /**
   * Render Grafik Batang SVG Pendapatan Harian dalam Bulan Terpilih
   */
  renderMonthlyRevenueChart(year, month, successfulBookings) {
    const chartContainer = document.getElementById('monthly-revenue-chart-root');
    if (!chartContainer) return;

    // Hitung jumlah hari dalam bulan tersebut
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate();

    // Bangun peta pendapatan per hari: { 1: 0, 2: 75000, ... }
    const dailyRevenueMap = {};
    for (let day = 1; day <= daysInMonth; day++) {
      dailyRevenueMap[day] = 0;
    }

    successfulBookings.forEach(b => {
      const parts = b.date.split('-');
      const day = Number(parts[2]);
      if (dailyRevenueMap[day] !== undefined) {
        dailyRevenueMap[day] += (Number(b.servicePrice) || 0);
      }
    });

    const maxRevenue = Math.max(...Object.values(dailyRevenueMap), 100000);

    // SVG dimensi
    const svgWidth = 900;
    const svgHeight = 260;
    const paddingLeft = 65;
    const paddingRight = 20;
    const paddingTop = 30;
    const paddingBottom = 40;
    const chartW = svgWidth - paddingLeft - paddingRight;
    const chartH = svgHeight - paddingTop - paddingBottom;

    const barWidth = Math.max(8, (chartW / daysInMonth) - 4);
    const step = chartW / daysInMonth;

    // Garis Grid Horisontal (0%, 50%, 100%)
    const gridLines = [0, maxRevenue * 0.5, maxRevenue].map((val) => {
      const yPos = paddingTop + chartH - (val / maxRevenue) * chartH;
      return `
        <line x1="${paddingLeft}" y1="${yPos}" x2="${svgWidth - paddingRight}" y2="${yPos}" class="chart-grid-line" stroke="#E7E5E4" stroke-dasharray="3 3"/>
        <text x="${paddingLeft - 8}" y="${yPos + 4}" class="chart-axis-text" text-anchor="end">${formatRupiah(val)}</text>
      `;
    }).join('');

    // Batang Tanggal
    const bars = Object.entries(dailyRevenueMap).map(([dayStr, rev]) => {
      const day = Number(dayStr);
      const x = paddingLeft + (day - 1) * step + (step - barWidth) / 2;
      const h = (rev / maxRevenue) * chartH;
      const y = paddingTop + chartH - h;

      // Label tanggal di sumbu X (tampilkan setiap 2 atau 3 hari agar tidak tumpang tindih)
      const showLabel = daysInMonth <= 15 || day === 1 || day % 3 === 0 || day === daysInMonth;

      return `
        <g class="bar-group" data-day="${day}" data-rev="${rev}">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(2, h)}" 
                class="chart-bar-rect" 
                fill="${rev > 0 ? 'var(--color-accent)' : '#E7E5E4'}" 
                rx="3"
                onmouseover="window.showChartTip(evt, '${day}', '${formatRupiah(rev)}')"
                onmouseout="window.hideChartTip()"/>
          ${showLabel ? `
            <text x="${x + barWidth / 2}" y="${svgHeight - 14}" class="chart-axis-text" text-anchor="middle">
              ${day}
            </text>
          ` : ''}
        </g>
      `;
    }).join('');

    chartContainer.innerHTML = `
      <div style="position:relative;">
        <div id="chart-tooltip-el" class="chart-tooltip"></div>
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%;height:auto;display:block;">
          ${gridLines}
          ${bars}
        </svg>
      </div>
    `;

    // Tooltip helper
    window.showChartTip = (evt, day, formatted) => {
      const tip = document.getElementById('chart-tooltip-el');
      if (tip) {
        tip.innerHTML = `Tgl ${day}: <strong>${formatted}</strong>`;
        tip.style.left = `${evt.offsetX}px`;
        tip.style.top = `${evt.offsetY}px`;
        tip.style.display = 'block';
      }
    };
    window.hideChartTip = () => {
      const tip = document.getElementById('chart-tooltip-el');
      if (tip) tip.style.display = 'none';
    };
  },

  /**
   * Manajemen Pemesanan Lengkap (pages/owner/bookings.html)
   */
  initBookingsManagement() {
    if (!this.checkAuth()) return;

    const tbody = document.getElementById('owner-bookings-tbody');
    const searchInput = document.getElementById('booking-search-input');
    const statusFilter = document.getElementById('booking-status-filter');
    const paymentFilter = document.getElementById('booking-payment-filter');

    const render = () => {
      let list = Booking.getAll();
      const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const st = statusFilter ? statusFilter.value : 'all';
      const pt = paymentFilter ? paymentFilter.value : 'all';

      if (q) {
        list = list.filter(b =>
          b.bookingCode.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerPhone.includes(q) ||
          b.serviceName.toLowerCase().includes(q)
        );
      }

      if (st !== 'all') list = list.filter(b => b.bookingStatus === st);
      if (pt !== 'all') list = list.filter(b => b.paymentStatus === pt);

      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">Tidak ada data pemesanan yang sesuai filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(b => `
        <tr>
          <td><strong class="tabular">${b.bookingCode}</strong></td>
          <td>
            <div style="font-weight:700;">${b.customerName}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${b.customerType} · ${b.customerPhone}</div>
          </td>
          <td>
            <div>${b.serviceName}</div>
            <div style="font-size:0.75rem;color:var(--color-accent);" class="amount">${formatRupiah(b.servicePrice)}</div>
          </td>
          <td><strong>${b.kapsterName}</strong></td>
          <td>${formatDate(b.date)}<br><strong>${b.time} WIB</strong></td>
          <td>
            <span class="status-badge status-${b.paymentStatus.toLowerCase()}">${b.paymentStatus}</span>
            <div style="font-size:0.6875rem;color:var(--color-text-muted);">${b.paymentMethod}</div>
          </td>
          <td>
            <select class="form-select status-change-select" data-id="${b.id}" style="padding:0.25rem 0.5rem;font-size:0.75rem;width:auto;">
              <option value="${BOOKING_STATUS.SCHEDULED}" ${b.bookingStatus === BOOKING_STATUS.SCHEDULED ? 'selected' : ''}>Terjadwal</option>
              <option value="${BOOKING_STATUS.IN_PROGRESS}" ${b.bookingStatus === BOOKING_STATUS.IN_PROGRESS ? 'selected' : ''}>Sedang Pangkas</option>
              <option value="${BOOKING_STATUS.COMPLETED}" ${b.bookingStatus === BOOKING_STATUS.COMPLETED ? 'selected' : ''}>Selesai</option>
              <option value="${BOOKING_STATUS.CANCELLED}" ${b.bookingStatus === BOOKING_STATUS.CANCELLED ? 'selected' : ''}>Dibatalkan</option>
            </select>
          </td>
          <td>
            <div class="row-actions">
              ${b.paymentStatus === 'Pending' ? `
                <button type="button" class="btn btn-success btn-sm btn-confirm-pay" data-id="${b.id}" title="Konfirmasi Bayar">
                  ✓ Bayar
                </button>
              ` : ''}
              <button type="button" class="btn btn-outline btn-sm btn-delete-booking" data-id="${b.id}" title="Hapus">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `).join('');

      this.bindPaymentConfirmButtons();

      document.querySelectorAll('.status-change-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          Booking.updateBookingStatus(sel.dataset.id, e.target.value);
          showToast(`Status pemesanan #${sel.dataset.id} diperbarui.`, 'info');
        });
      });

      document.querySelectorAll('.btn-delete-booking').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Hapus pemesanan ini dari sistem?')) {
            Booking.deleteBooking(btn.dataset.id);
            showToast('Pemesanan berhasil dihapus.', 'success');
            render();
          }
        });
      });
    };

    searchInput?.addEventListener('input', render);
    statusFilter?.addEventListener('change', render);
    paymentFilter?.addEventListener('change', render);
    render();
  },

  /**
   * Konfirmasi Pembayaran (pages/owner/payments.html)
   */
  initPaymentsManagement() {
    if (!this.checkAuth()) return;

    const tbody = document.getElementById('owner-payments-tbody');
    const filterSelect = document.getElementById('payment-method-filter');
    const statusSelect = document.getElementById('payment-status-filter');

    const render = () => {
      let bookings = Booking.getAll();
      const method = filterSelect ? filterSelect.value : 'all';
      const status = statusSelect ? statusSelect.value : 'all';

      if (method !== 'all') bookings = bookings.filter(b => b.paymentMethod === method);
      if (status !== 'all') bookings = bookings.filter(b => b.paymentStatus === status);

      if (!tbody) return;

      if (bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">Tidak ada transaksi pembayaran.</td></tr>`;
        return;
      }

      tbody.innerHTML = bookings.map(b => `
        <tr>
          <td><strong class="tabular">${b.bookingCode}</strong></td>
          <td>
            <div style="font-weight:700;">${b.customerName}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${b.customerType}</div>
          </td>
          <td>${b.serviceName}</td>
          <td><strong class="amount">${formatRupiah(b.servicePrice)}</strong></td>
          <td><span style="font-weight:600;">${b.paymentMethod}</span></td>
          <td>
            <span class="status-badge status-${b.paymentStatus.toLowerCase()}">${b.paymentStatus}</span>
            ${b.pointsAwarded > 0 ? `<div style="font-size:0.6875rem;color:var(--color-accent);font-weight:700;">★ +${b.pointsAwarded} Pts</div>` : ''}
          </td>
          <td>
            ${b.paymentStatus === 'Pending' ? `
              <div style="display:flex;gap:0.375rem;">
                <button type="button" class="btn btn-success btn-sm btn-confirm-pay" data-id="${b.id}">
                  Konfirmasi Lunas
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-fail-pay" data-id="${b.id}">
                  Gagal
                </button>
              </div>
            ` : `
              <span style="font-size:0.75rem;color:var(--color-text-muted);">
                ${b.paymentConfirmedAt ? `Diverifikasi: ${b.paymentConfirmedAt}` : 'Terverifikasi'}
              </span>
            `}
          </td>
        </tr>
      `).join('');

      this.bindPaymentConfirmButtons();

      document.querySelectorAll('.btn-fail-pay').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Tandai pembayaran ini sebagai Gagal?')) {
            Payment.failPayment(btn.dataset.id);
            showToast('Status pembayaran diubah menjadi Failed.', 'warning');
            render();
          }
        });
      });
    };

    filterSelect?.addEventListener('change', render);
    statusSelect?.addEventListener('change', render);
    render();
  },

  /**
   * Persetujuan Hadiah Member (pages/owner/redemptions.html)
   */
  initRedemptionsManagement() {
    if (!this.checkAuth()) return;

    const tbody = document.getElementById('owner-redemptions-tbody');
    const filterSelect = document.getElementById('redemption-status-filter');

    const render = () => {
      let list = Rewards.getRedemptions();
      const status = filterSelect ? filterSelect.value : 'all';

      if (status !== 'all') list = list.filter(r => r.status === status);

      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">Tidak ada permohonan penukaran reward.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(r => `
        <tr>
          <td><strong class="tabular">${r.id}</strong></td>
          <td>
            <div style="font-weight:700;">${r.memberName}</div>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">${r.memberEmail}</div>
          </td>
          <td><strong>${r.rewardName}</strong></td>
          <td><span style="color:var(--color-accent);font-weight:700;">★ ${r.pointsSpent} Pts</span></td>
          <td>${r.createdAt}</td>
          <td><span class="status-badge status-${r.status.toLowerCase()}">${r.status}</span></td>
          <td>
            <div class="row-actions">
              ${r.status === 'Pending' ? `
                <button type="button" class="btn btn-success btn-sm btn-approve-rdm" data-id="${r.id}" title="Setujui Klaim">
                  Setujui
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-reject-rdm" data-id="${r.id}" title="Tolak">
                  Tolak
                </button>
              ` : ''}
              ${r.status === 'Approved' ? `
                <button type="button" class="btn btn-primary btn-sm btn-complete-rdm" data-id="${r.id}" title="Tandai Sudah Diambil Member">
                  Tandai Diambil
                </button>
              ` : ''}
              ${r.status === 'Completed' ? `
                <span style="font-size:0.75rem;color:var(--color-success);font-weight:600;">✓ Selesai Diambil</span>
              ` : ''}
              ${r.status === 'Rejected' ? `
                <span style="font-size:0.75rem;color:var(--color-danger);font-weight:600;">✕ Ditolak</span>
              ` : ''}
            </div>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.btn-approve-rdm').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Setujui klaim hadiah ini? Poin member akan dipotong dan stok barang dikurangi.')) {
            const res = Rewards.approveRedemption(btn.dataset.id);
            if (res.success) {
              showToast('Penukaran hadiah berhasil disetujui!', 'success');
              render();
            } else {
              showToast(res.message, 'error');
            }
          }
        });
      });

      document.querySelectorAll('.btn-reject-rdm').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Tolak permohonan hadiah ini? Poin member tidak akan terpotong.')) {
            const res = Rewards.rejectRedemption(btn.dataset.id);
            if (res.success) {
              showToast('Permintaan hadiah ditolak.', 'info');
              render();
            } else {
              showToast(res.message, 'error');
            }
          }
        });
      });

      document.querySelectorAll('.btn-complete-rdm').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Konfirmasi bahwa member telah mengambil barang secara fisik di studio A3HAIRSTUDIO?')) {
            const res = Rewards.completeRedemption(btn.dataset.id);
            if (res.success) {
              showToast('Status selesai: Hadiah telah diserahkan ke member!', 'success');
              render();
            } else {
              showToast(res.message, 'error');
            }
          }
        });
      });
    };

    filterSelect?.addEventListener('change', render);
    render();
  }
};
