/**
 * ============================================================================
 * customer.js — FUNGSI & INTERAKSI PELANGGAN (MEMBER & GUEST)
 * ============================================================================
 * Tanggung Jawab Modul:
 * 1. Logika Pemesanan (Booking, Validasi Ketersediaan Slot Waktu, Pembuatan Kode)
 * 2. Logika Pembayaran (Cash, QRIS, Virtual Account)
 * 3. Logika Loyalty Point (10 poin tiap booking sukses untuk Member)
 * 4. Logika Katalog Hadiah & Pengajuan Penukaran Reward
 * 5. Pengendali Antarmuka Halaman Pelanggan (CustomerApp)
 * ============================================================================
 */

import {
  Storage,
  STORAGE_KEYS,
  Auth,
  ROLES,
  TIME_SLOTS,
  formatRupiah,
  formatDate,
  showToast
} from './common.js';


/* ============================================================================
 * 1. LOGIKA STATUS & MANAJEMEN PEMESANAN (Booking)
 * ============================================================================
 */
export const BOOKING_STATUS = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In-Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export const Booking = {
  getAll() {
    return Storage.get(STORAGE_KEYS.BOOKINGS, []);
  },

  getById(id) {
    const list = this.getAll();
    return list.find(b => b.id === id || b.bookingCode === id) || null;
  },

  getByMemberId(memberId) {
    const list = this.getAll();
    return list.filter(b => b.customerId === memberId);
  },

  /**
   * Cek ketersediaan slot jam berdasarkan ID kapster dan tanggal
   */
  getAvailableSlots(kapsterId, dateString) {
    const allBookings = this.getAll();
    const occupied = allBookings.filter(b =>
      b.kapsterId === kapsterId &&
      b.date === dateString &&
      b.bookingStatus !== BOOKING_STATUS.CANCELLED
    );

    const bookedTimes = new Set(occupied.map(b => b.time));

    return TIME_SLOTS.map(time => ({
      time: time,
      available: !bookedTimes.has(time)
    }));
  },

  generateBookingCode() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    return `A3-${year}-${randomNum}`;
  },

  createBooking(payload) {
    const {
      customerType,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      serviceId,
      kapsterId,
      date,
      time,
      paymentMethod
    } = payload;

    const services = Storage.get(STORAGE_KEYS.SERVICES, []);
    const service = services.find(s => s.id === serviceId);
    if (!service) {
      return { success: false, message: 'Layanan yang dipilih tidak valid.' };
    }

    const kapsters = Storage.get(STORAGE_KEYS.KAPSTERS, []);
    const kapster = kapsters.find(k => k.id === kapsterId);
    if (!kapster) {
      return { success: false, message: 'Kapster yang dipilih tidak valid.' };
    }

    const slots = this.getAvailableSlots(kapsterId, date);
    const slot = slots.find(s => s.time === time);
    if (!slot || !slot.available) {
      return { success: false, message: `Jadwal ${time} pada tanggal ${date} dengan ${kapster.name} sudah tidak tersedia.` };
    }

    if (!customerName || !customerPhone) {
      return { success: false, message: 'Nama dan nomor telepon pelanggan wajib diisi.' };
    }

    const bookingId = 'BKB-' + Date.now().toString(36).toUpperCase();
    const bookingCode = this.generateBookingCode();

    const newBooking = {
      id: bookingId,
      bookingCode: bookingCode,
      customerType: customerType || 'Guest',
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : '',
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDuration: service.duration,
      kapsterId: kapster.id,
      kapsterName: kapster.name,
      date: date,
      time: time,
      paymentMethod: paymentMethod,
      paymentStatus: 'Pending',
      bookingStatus: BOOKING_STATUS.SCHEDULED,
      pointsAwarded: 0,
      createdAt: new Date().toISOString()
    };

    const bookings = this.getAll();
    bookings.unshift(newBooking);
    Storage.set(STORAGE_KEYS.BOOKINGS, bookings);

    return {
      success: true,
      booking: newBooking
    };
  },

  updateBookingStatus(bookingId, newStatus) {
    const bookings = this.getAll();
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) return { success: false, message: 'Booking tidak ditemukan.' };

    bookings[index].bookingStatus = newStatus;
    Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
    return { success: true, booking: bookings[index] };
  },

  deleteBooking(bookingId) {
    const bookings = this.getAll();
    const filtered = bookings.filter(b => b.id !== bookingId);
    Storage.set(STORAGE_KEYS.BOOKINGS, filtered);
    return { success: true };
  }
};


/* ============================================================================
 * 2. LOGIKA PEMBAYARAN & KASIR (Payment)
 * ============================================================================
 */
export const PAYMENT_METHODS = {
  CASH: 'Cash',
  QRIS: 'QRIS',
  VA: 'Virtual Account'
};

export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  EXPIRED: 'Expired'
};

export const Payment = {
  getBookingPayment(bookingId) {
    const bookings = Storage.get(STORAGE_KEYS.BOOKINGS, []);
    return bookings.find(b => b.id === bookingId) || null;
  },

  /**
   * Konfirmasi pembayaran lunas.
   * Memberikan 10 Loyalty Point jika pelanggan adalah Member terdaftar.
   */
  confirmPayment(bookingId, confirmedBy = 'owner') {
    const bookings = Storage.get(STORAGE_KEYS.BOOKINGS, []);
    const index = bookings.findIndex(b => b.id === bookingId);

    if (index === -1) {
      return { success: false, message: 'Data booking tidak ditemukan.' };
    }

    const booking = bookings[index];
    if (booking.paymentStatus === PAYMENT_STATUS.SUCCESS) {
      return { success: false, message: 'Pembayaran untuk booking ini sudah berstatus Success.' };
    }

    booking.paymentStatus = PAYMENT_STATUS.SUCCESS;
    booking.paymentConfirmedAt = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    booking.paymentConfirmedBy = confirmedBy;

    bookings[index] = booking;
    Storage.set(STORAGE_KEYS.BOOKINGS, bookings);

    let loyaltyResult = null;
    if (booking.customerType === 'Member' && booking.customerId) {
      loyaltyResult = Loyalty.awardPointsForBooking(booking);
    }

    return {
      success: true,
      booking: booking,
      loyalty: loyaltyResult
    };
  },

  failPayment(bookingId, reason = 'Pembayaran gagal diverifikasi') {
    const bookings = Storage.get(STORAGE_KEYS.BOOKINGS, []);
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) return { success: false, message: 'Booking tidak ditemukan.' };

    bookings[index].paymentStatus = PAYMENT_STATUS.FAILED;
    bookings[index].paymentFailReason = reason;
    Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
    return { success: true, booking: bookings[index] };
  },

  generateVANumber(bookingCode) {
    const numericPart = bookingCode.replace(/\D/g, '') || '2026';
    return `880812${numericPart.padStart(8, '0')}`;
  }
};


/* ============================================================================
 * 3. LOGIKA POIN LOYALITAS (Loyalty)
 * ============================================================================
 */
export const Loyalty = {
  getConfig() {
    return Storage.get(STORAGE_KEYS.LOYALTY_CONFIG, {
      pointsPerTransaction: 10,
      minRedemptionPoints: 30,
      enabled: true
    });
  },

  updateConfig(newConfig) {
    const current = this.getConfig();
    const updated = { ...current, ...newConfig };
    Storage.set(STORAGE_KEYS.LOYALTY_CONFIG, updated);
    return updated;
  },

  getMemberPoints(memberId) {
    const members = Storage.get(STORAGE_KEYS.MEMBERS, []);
    const member = members.find(m => m.id === memberId);
    return member ? (member.points || 0) : 0;
  },

  getPointsHistory(memberId = null) {
    const history = Storage.get(STORAGE_KEYS.POINTS_HISTORY, []);
    if (!memberId) {
      return history;
    }
    return history.filter(h => h.memberId === memberId);
  },

  /**
   * Memberikan 10 poin kepada Member saat pembayaran berstatus Sukses
   */
  awardPointsForBooking(booking) {
    if (!booking || booking.customerType !== 'Member' || !booking.customerId) {
      return { success: false, message: 'Hanya Member yang berhak memperoleh Loyalty Point.' };
    }

    if (booking.pointsAwarded && booking.pointsAwarded > 0) {
      return { success: false, message: 'Poin untuk transaksi ini sudah pernah diberikan.' };
    }

    const config = this.getConfig();
    if (!config.enabled) {
      return { success: false, message: 'Program loyalitas sedang dinonaktifkan.' };
    }

    const pointsToAward = config.pointsPerTransaction || 10;

    const members = Storage.get(STORAGE_KEYS.MEMBERS, []);
    const memberIndex = members.findIndex(m => m.id === booking.customerId);
    if (memberIndex === -1) {
      return { success: false, message: 'Data member tidak ditemukan.' };
    }

    members[memberIndex].points = (members[memberIndex].points || 0) + pointsToAward;
    Storage.set(STORAGE_KEYS.MEMBERS, members);

    const history = Storage.get(STORAGE_KEYS.POINTS_HISTORY, []);
    const historyEntry = {
      id: 'pth-' + Date.now().toString(36),
      memberId: booking.customerId,
      bookingId: booking.id,
      type: 'earned',
      points: pointsToAward,
      description: `Poin Booking #${booking.bookingCode} (${booking.serviceName})`,
      date: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
    };
    history.unshift(historyEntry);
    Storage.set(STORAGE_KEYS.POINTS_HISTORY, history);

    const bookings = Storage.get(STORAGE_KEYS.BOOKINGS, []);
    const bIndex = bookings.findIndex(b => b.id === booking.id);
    if (bIndex !== -1) {
      bookings[bIndex].pointsAwarded = pointsToAward;
      Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
    }

    return { success: true, pointsAwarded: pointsToAward, newBalance: members[memberIndex].points };
  },

  deductPoints(memberId, points, description = 'Penukaran Hadiah') {
    const members = Storage.get(STORAGE_KEYS.MEMBERS, []);
    const memberIndex = members.findIndex(m => m.id === memberId);
    if (memberIndex === -1) {
      return { success: false, message: 'Member tidak ditemukan.' };
    }

    const currentBalance = members[memberIndex].points || 0;
    if (currentBalance < points) {
      return { success: false, message: 'Saldo poin tidak mencukupi.' };
    }

    members[memberIndex].points = currentBalance - points;
    Storage.set(STORAGE_KEYS.MEMBERS, members);

    const history = Storage.get(STORAGE_KEYS.POINTS_HISTORY, []);
    const historyEntry = {
      id: 'pth-' + Date.now().toString(36),
      memberId: memberId,
      bookingId: null,
      type: 'spent',
      points: -points,
      description: description,
      date: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
    };
    history.unshift(historyEntry);
    Storage.set(STORAGE_KEYS.POINTS_HISTORY, history);

    return { success: true, newBalance: members[memberIndex].points };
  }
};


/* ============================================================================
 * 4. LOGIKA KATALOG & KLAIM HADIAH (Rewards)
 * ============================================================================
 */
export const Rewards = {
  getAll() {
    return Storage.get(STORAGE_KEYS.REWARDS, []);
  },

  getById(id) {
    const list = this.getAll();
    return list.find(r => r.id === id) || null;
  },

  create(rewardData) {
    const list = this.getAll();
    const newReward = {
      id: 'rwd-' + Date.now().toString(36),
      name: rewardData.name,
      pointsCost: Number(rewardData.pointsCost),
      stock: Number(rewardData.stock),
      description: rewardData.description || '',
      active: true
    };
    list.unshift(newReward);
    Storage.set(STORAGE_KEYS.REWARDS, list);
    return newReward;
  },

  update(id, updateData) {
    const list = this.getAll();
    const index = list.findIndex(r => r.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...updateData };
    Storage.set(STORAGE_KEYS.REWARDS, list);
    return list[index];
  },

  delete(id) {
    const list = this.getAll();
    const filtered = list.filter(r => r.id !== id);
    Storage.set(STORAGE_KEYS.REWARDS, filtered);
    return true;
  },

  getRedemptions(memberId = null) {
    const list = Storage.get(STORAGE_KEYS.REDEMPTIONS, []);
    if (!memberId) {
      return list;
    }
    return list.filter(item => item.memberId === memberId);
  },

  requestRedemption(member, rewardId) {
    const reward = this.getById(rewardId);
    if (!reward || !reward.active) {
      return { success: false, message: 'Hadiah tidak valid atau tidak tersedia.' };
    }

    if (reward.stock <= 0) {
      return { success: false, message: 'Stok hadiah ini sedang habis.' };
    }

    const currentPoints = Loyalty.getMemberPoints(member.id);
    if (currentPoints < reward.pointsCost) {
      return { success: false, message: `Saldo poin Anda (${currentPoints} pts) tidak mencukupi untuk hadiah ini (${reward.pointsCost} pts).` };
    }

    const redemption = {
      id: 'rdm-' + Date.now().toString(36),
      memberId: member.id,
      memberName: member.name,
      memberEmail: member.email,
      rewardId: reward.id,
      rewardName: reward.name,
      pointsSpent: reward.pointsCost,
      status: 'Pending',
      createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }),
      approvedAt: null,
      completedAt: null
    };

    const redemptions = Storage.get(STORAGE_KEYS.REDEMPTIONS, []);
    redemptions.unshift(redemption);
    Storage.set(STORAGE_KEYS.REDEMPTIONS, redemptions);

    return { success: true, redemption };
  },

  approveRedemption(redemptionId) {
    const redemptions = Storage.get(STORAGE_KEYS.REDEMPTIONS, []);
    const index = redemptions.findIndex(r => r.id === redemptionId);
    if (index === -1) {
      return { success: false, message: 'Permintaan penukaran tidak ditemukan.' };
    }

    const item = redemptions[index];
    if (item.status !== 'Pending') {
      return { success: false, message: `Permintaan ini sudah berstatus ${item.status}.` };
    }

    const reward = this.getById(item.rewardId);
    if (!reward || reward.stock <= 0) {
      return { success: false, message: 'Stok barang sudah tidak mencukupi.' };
    }

    const memberPoints = Loyalty.getMemberPoints(item.memberId);
    if (memberPoints < item.pointsSpent) {
      return { success: false, message: 'Saldo poin member tidak mencukupi saat hendak disetujui.' };
    }

    const deductRes = Loyalty.deductPoints(
      item.memberId,
      item.pointsSpent,
      `Penukaran Hadiah Disetujui: ${item.rewardName}`
    );
    if (!deductRes.success) {
      return deductRes;
    }

    this.update(reward.id, { stock: reward.stock - 1 });

    item.status = 'Approved';
    item.approvedAt = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    Storage.set(STORAGE_KEYS.REDEMPTIONS, redemptions);

    return { success: true, redemption: item };
  },

  rejectRedemption(redemptionId, reason = 'Ditolak oleh Owner') {
    const redemptions = Storage.get(STORAGE_KEYS.REDEMPTIONS, []);
    const index = redemptions.findIndex(r => r.id === redemptionId);
    if (index === -1) {
      return { success: false, message: 'Permintaan penukaran tidak ditemukan.' };
    }

    const item = redemptions[index];
    if (item.status !== 'Pending') {
      return { success: false, message: `Permintaan ini sudah berstatus ${item.status}.` };
    }

    item.status = 'Rejected';
    item.rejectReason = reason;
    Storage.set(STORAGE_KEYS.REDEMPTIONS, redemptions);

    return { success: true, redemption: item };
  },

  completeRedemption(redemptionId) {
    const redemptions = Storage.get(STORAGE_KEYS.REDEMPTIONS, []);
    const index = redemptions.findIndex(r => r.id === redemptionId);
    if (index === -1) {
      return { success: false, message: 'Permintaan penukaran tidak ditemukan.' };
    }

    const item = redemptions[index];
    if (item.status !== 'Approved') {
      return { success: false, message: 'Hadiah harus berstatus Approved sebelum dapat ditandai selesai/diambil.' };
    }

    item.status = 'Completed';
    item.completedAt = new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    Storage.set(STORAGE_KEYS.REDEMPTIONS, redemptions);

    return { success: true, redemption: item };
  }
};


/* ============================================================================
 * 5. PENGENDALI ANTARMUKA PELANGGAN (CustomerApp)
 * ============================================================================
 */
export const CustomerApp = {
  /**
   * Wizard 5 Langkah Pemesanan Pangkas (pages/customer/booking.html)
   */
  initBookingWizard() {
    const wizardEl = document.getElementById('booking-wizard-container');
    if (!wizardEl) return;

    const user = Auth.getCurrentUser();
    const isMember = user && user.role === ROLES.MEMBER;

    const state = {
      step: 1,
      serviceId: null,
      kapsterId: null,
      date: new Date().toISOString().split('T')[0],
      time: null,
      customerType: isMember ? 'Member' : 'Guest',
      customerId: isMember ? user.id : null,
      customerName: user ? user.name : '',
      customerPhone: user ? (user.phone || '') : '',
      customerEmail: user ? (user.email || '') : '',
      paymentMethod: PAYMENT_METHODS.CASH
    };

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('service')) state.serviceId = urlParams.get('service');
    if (urlParams.get('kapster')) state.kapsterId = urlParams.get('kapster');

    function renderStep() {
      const services = Storage.get(STORAGE_KEYS.SERVICES, []).filter(s => s.active);
      const kapsters = Storage.get(STORAGE_KEYS.KAPSTERS, []).filter(k => k.active);

      if (!state.serviceId && services.length > 0) state.serviceId = services[0].id;
      if (!state.kapsterId && kapsters.length > 0) state.kapsterId = kapsters[0].id;

      const selectedService = services.find(s => s.id === state.serviceId) || services[0];
      const selectedKapster = kapsters.find(k => k.id === state.kapsterId) || kapsters[0];

      wizardEl.innerHTML = `
        <div class="booking-progress">
          <div class="step-item ${state.step >= 1 ? (state.step > 1 ? 'completed' : 'active') : ''}">
            <div class="step-circle">${state.step > 1 ? '✓' : '1'}</div>
            <span class="step-label">Layanan</span>
          </div>
          <div class="step-item ${state.step >= 2 ? (state.step > 2 ? 'completed' : 'active') : ''}">
            <div class="step-circle">${state.step > 2 ? '✓' : '2'}</div>
            <span class="step-label">Kapster</span>
          </div>
          <div class="step-item ${state.step >= 3 ? (state.step > 3 ? 'completed' : 'active') : ''}">
            <div class="step-circle">${state.step > 3 ? '✓' : '3'}</div>
            <span class="step-label">Waktu</span>
          </div>
          <div class="step-item ${state.step >= 4 ? (state.step > 4 ? 'completed' : 'active') : ''}">
            <div class="step-circle">${state.step > 4 ? '✓' : '4'}</div>
            <span class="step-label">Data Diri</span>
          </div>
          <div class="step-item ${state.step >= 5 ? 'active' : ''}">
            <div class="step-circle">5</div>
            <span class="step-label">Pembayaran</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 340px;gap:2rem;align-items:start;">
          <!-- Kiri: Konten Langkah -->
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">
                ${state.step === 1 ? 'Pilih Layanan Barbershop' : ''}
                ${state.step === 2 ? 'Pilih Master Kapster' : ''}
                ${state.step === 3 ? 'Pilih Tanggal & Waktu Reservasi' : ''}
                ${state.step === 4 ? 'Informasi Kontak Pelanggan' : ''}
                ${state.step === 5 ? 'Metode Pembayaran' : ''}
              </h2>
            </div>
            <div class="card-body">
              ${renderStepContent(services, kapsters, selectedService, selectedKapster)}
            </div>
            <div class="card-footer" style="justify-content:space-between;">
              ${state.step > 1 ? `
                <button type="button" class="btn btn-outline" id="wizard-prev-btn">&larr; Kembali</button>
              ` : `<div></div>`}
              ${state.step < 5 ? `
                <button type="button" class="btn btn-primary" id="wizard-next-btn">Lanjut &rarr;</button>
              ` : `
                <button type="button" class="btn btn-primary" id="wizard-submit-btn">Konfirmasi & Simpan Booking</button>
              `}
            </div>
          </div>

          <!-- Kanan: Ringkasan Booking -->
          <div class="card" style="position:sticky;top:90px;">
            <div class="card-header" style="background:#FAF8F5;">
              <h3 style="font-size:1rem;font-weight:700;">Ringkasan Booking</h3>
            </div>
            <div class="card-body" style="font-size:0.875rem;">
              <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border-subtle);">
                <div style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;margin-bottom:0.25rem;">Layanan</div>
                <div style="font-weight:700;">${selectedService ? selectedService.name : '-'}</div>
                <div style="font-size:0.8125rem;color:var(--color-text-secondary);">${selectedService ? selectedService.duration + ' menit' : ''}</div>
              </div>

              <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border-subtle);">
                <div style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;margin-bottom:0.25rem;">Kapster</div>
                <div style="font-weight:700;">${selectedKapster ? selectedKapster.name : '-'}</div>
              </div>

              <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border-subtle);">
                <div style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;margin-bottom:0.25rem;">Waktu & Jam</div>
                <div style="font-weight:700;">${formatDate(state.date)}</div>
                <div style="font-size:0.8125rem;color:var(--color-accent);font-weight:600;">${state.time ? state.time + ' WIB' : 'Pilih jam...'}</div>
              </div>

              <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border-subtle);">
                <div style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;margin-bottom:0.25rem;">Tipe Pelanggan</div>
                <div style="font-weight:600;display:flex;align-items:center;gap:0.375rem;">
                  <span>${state.customerType}</span>
                  ${state.customerType === 'Member' ? '<span style="font-size:0.75rem;color:var(--color-accent);">(+10 pts saat sukses)</span>' : ''}
                </div>
              </div>

              <div style="margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border-subtle);">
                <div style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;margin-bottom:0.25rem;">Metode Bayar</div>
                <div style="font-weight:700;color:var(--color-accent);">${state.paymentMethod || 'Cash'}</div>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:0.5rem;">
                <span style="font-weight:700;">Total Tarif:</span>
                <span style="font-size:1.25rem;font-weight:800;color:var(--color-accent);" class="amount">
                  ${selectedService ? formatRupiah(selectedService.price) : 'Rp 0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      `;

      bindStepEvents(services, kapsters);
    }

    function renderStepContent(services, kapsters, selectedService, selectedKapster) {
      if (state.step === 1) {
        return `
          <div class="service-grid">
            ${services.map(s => `
              <div class="service-card ${s.id === state.serviceId ? 'selected' : ''}" data-service-id="${s.id}">
                <div>
                  <h3 style="font-size:1rem;font-weight:700;">${s.name}</h3>
                  <div class="service-meta">
                    <span>${s.category}</span>
                    <span>·</span>
                    <span>⏱ ${s.duration} Menit</span>
                  </div>
                  <p style="font-size:0.8125rem;margin-bottom:1rem;">${s.description}</p>
                </div>
                <div class="service-price">${formatRupiah(s.price)}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (state.step === 2) {
        return `
          <div class="kapster-grid">
            ${kapsters.map(k => `
              <div class="kapster-card ${k.id === state.kapsterId ? 'selected' : ''}" data-kapster-id="${k.id}">
                <div class="kapster-avatar">${k.avatar || k.name.charAt(0)}</div>
                <h3 class="kapster-name">${k.name}</h3>
                <div class="kapster-specialty">${k.specialty}</div>
                <p style="font-size:0.8125rem;color:var(--color-text-secondary);">${k.bio}</p>
                <div style="margin-top:0.75rem;font-size:0.75rem;color:var(--color-text-muted);">Pengalaman: ${k.experience}</div>
              </div>
            `).join('')}
          </div>
        `;
      }

      if (state.step === 3) {
        const slots = Booking.getAvailableSlots(state.kapsterId, state.date);
        return `
          <div>
            <div class="form-group" style="max-width:300px;margin-bottom:1.5rem;">
              <label class="form-label required">Pilih Tanggal Reservasi</label>
              <input type="date" id="booking-date-input" class="form-input" min="${new Date().toISOString().split('T')[0]}" value="${state.date}">
              <div class="form-hint">Jam operasional: 09:00 - 21:00 WIB</div>
            </div>

            <div class="form-group">
              <label class="form-label required">Pilih Jam Reservasi dengan ${selectedKapster ? selectedKapster.name : 'Kapster'}</label>
              <div class="time-slot-grid">
                ${slots.map(s => `
                  <button type="button" class="time-slot-btn ${s.available ? '' : 'disabled'} ${state.time === s.time ? 'selected' : ''}" data-time="${s.time}" ${s.available ? '' : 'disabled'}>
                    ${s.time}
                  </button>
                `).join('')}
              </div>
              <div class="form-hint" style="margin-top:0.5rem;">Tombol abu-abu berarti jadwal jam tersebut sudah dipesan orang lain.</div>
            </div>
          </div>
        `;
      }

      if (state.step === 4) {
        return `
          <div style="max-width:480px;">
            <div class="form-group">
              <label class="form-label required">Nama Lengkap</label>
              <input type="text" id="cust-name-input" class="form-input" value="${state.customerName}" placeholder="cth: Budi Santoso" required>
            </div>
            <div class="form-group">
              <label class="form-label required">Nomor WhatsApp / HP Aktif</label>
              <input type="tel" id="cust-phone-input" class="form-input" value="${state.customerPhone}" placeholder="cth: 081234567890" required>
              <div class="form-hint">Diperlukan untuk konfirmasi jadwal dan kasir</div>
            </div>
            <div class="form-group">
              <label class="form-label">Alamat Email (Opsional)</label>
              <input type="email" id="cust-email-input" class="form-input" value="${state.customerEmail}" placeholder="cth: budi@gmail.com">
            </div>
          </div>
        `;
      }

      if (state.step === 5) {
        return `
          <div>
            <p style="font-size:0.875rem;color:var(--color-text-secondary);margin-bottom:1.25rem;">
              Silakan klik pada salah satu pilihan untuk memilih metode pembayaran:
            </p>

            <div class="payment-methods-grid">
              <!-- Pilihan 1: Cash -->
              <div class="payment-method-card ${state.paymentMethod === PAYMENT_METHODS.CASH ? 'selected' : ''}" data-method="${PAYMENT_METHODS.CASH}">
                <div class="payment-radio-circle">
                  <div class="payment-radio-dot"></div>
                </div>
                <div class="payment-icon-box">💵</div>
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                    <div class="payment-card-title">Cash (Tunai di Kasir)</div>
                    ${state.paymentMethod === PAYMENT_METHODS.CASH ? '<span class="status-badge status-success" style="font-size:0.7rem;padding:0.15rem 0.5rem;">Dipilih ✓</span>' : ''}
                  </div>
                  <div class="payment-card-desc">Bayar tunai langsung di meja kasir setelah sesi pangkas rambut selesai.</div>
                </div>
              </div>

              <!-- Pilihan 2: QRIS -->
              <div class="payment-method-card ${state.paymentMethod === PAYMENT_METHODS.QRIS ? 'selected' : ''}" data-method="${PAYMENT_METHODS.QRIS}">
                <div class="payment-radio-circle">
                  <div class="payment-radio-dot"></div>
                </div>
                <div class="payment-icon-box">📱</div>
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                    <div class="payment-card-title">QRIS Dinamis</div>
                    ${state.paymentMethod === PAYMENT_METHODS.QRIS ? '<span class="status-badge status-success" style="font-size:0.7rem;padding:0.15rem 0.5rem;">Dipilih ✓</span>' : ''}
                  </div>
                  <div class="payment-card-desc">Scan kode QR instan menggunakan GoPay, OVO, Dana, ShopeePay, BCA, atau mobile banking lainnya.</div>
                </div>
              </div>

              <!-- Pilihan 3: Virtual Account -->
              <div class="payment-method-card ${state.paymentMethod === PAYMENT_METHODS.VA ? 'selected' : ''}" data-method="${PAYMENT_METHODS.VA}">
                <div class="payment-radio-circle">
                  <div class="payment-radio-dot"></div>
                </div>
                <div class="payment-icon-box">🏦</div>
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                    <div class="payment-card-title">Virtual Account Bank</div>
                    ${state.paymentMethod === PAYMENT_METHODS.VA ? '<span class="status-badge status-success" style="font-size:0.7rem;padding:0.15rem 0.5rem;">Dipilih ✓</span>' : ''}
                  </div>
                  <div class="payment-card-desc">Transfer langsung lewat nomor Virtual Account (BCA/Mandiri/BRI) secara otomatis.</div>
                </div>
              </div>
            </div>

            <div style="margin-top:1.5rem;padding:1rem;background:var(--color-surface-subtle);border-radius:var(--radius-small);font-size:0.8125rem;color:var(--color-text-secondary);border:1px solid var(--color-border-subtle);">
              ℹ️ Pembayaran dapat langsung diselesaikan daring atau dibayar tunai di kasir. Khusus <strong>Member</strong>, Anda akan memperoleh <strong>10 Poin Loyalitas</strong> begitu transaksi lunas.
            </div>
          </div>
        `;
      }
    }

    function bindStepEvents(services, kapsters) {
      if (state.step === 1) {
        document.querySelectorAll('.service-card').forEach(card => {
          card.addEventListener('click', () => {
            state.serviceId = card.dataset.serviceId;
            renderStep();
          });
        });
      }

      if (state.step === 2) {
        document.querySelectorAll('.kapster-card').forEach(card => {
          card.addEventListener('click', () => {
            state.kapsterId = card.dataset.kapsterId;
            state.time = null;
            renderStep();
          });
        });
      }

      if (state.step === 3) {
        const dateInput = document.getElementById('booking-date-input');
        if (dateInput) {
          dateInput.addEventListener('change', (e) => {
            state.date = e.target.value;
            state.time = null;
            renderStep();
          });
        }

        document.querySelectorAll('.time-slot-btn:not(.disabled)').forEach(btn => {
          btn.addEventListener('click', () => {
            state.time = btn.dataset.time;
            renderStep();
          });
        });
      }

      if (state.step === 5) {
        document.querySelectorAll('.payment-method-card, .payment-card').forEach(card => {
          card.addEventListener('click', () => {
            state.paymentMethod = card.dataset.method;
            renderStep();
          });
        });
      }

      document.getElementById('wizard-prev-btn')?.addEventListener('click', () => {
        if (state.step > 1) {
          state.step--;
          renderStep();
        }
      });

      document.getElementById('wizard-next-btn')?.addEventListener('click', () => {
        if (state.step === 1 && !state.serviceId) {
          showToast('Silakan pilih salah satu layanan pangkas.', 'error');
          return;
        }
        if (state.step === 2 && !state.kapsterId) {
          showToast('Silakan pilih master kapster.', 'error');
          return;
        }
        if (state.step === 3 && !state.time) {
          showToast('Silakan pilih jam reservasi yang tersedia.', 'error');
          return;
        }
        if (state.step === 4) {
          const nameInput = document.getElementById('cust-name-input');
          const phoneInput = document.getElementById('cust-phone-input');
          const emailInput = document.getElementById('cust-email-input');

          if (!nameInput.value.trim() || !phoneInput.value.trim()) {
            showToast('Nama dan nomor WhatsApp wajib diisi.', 'error');
            return;
          }

          state.customerName = nameInput.value.trim();
          state.customerPhone = phoneInput.value.trim();
          state.customerEmail = emailInput ? emailInput.value.trim() : '';
        }

        state.step++;
        renderStep();
      });

      document.getElementById('wizard-submit-btn')?.addEventListener('click', () => {
        const res = Booking.createBooking({
          customerType: state.customerType,
          customerId: state.customerId,
          customerName: state.customerName,
          customerPhone: state.customerPhone,
          customerEmail: state.customerEmail,
          serviceId: state.serviceId,
          kapsterId: state.kapsterId,
          date: state.date,
          time: state.time,
          paymentMethod: state.paymentMethod
        });

        if (res.success) {
          showToast('Booking berhasil dibuat! Kode: ' + res.booking.bookingCode, 'success');
          setTimeout(() => {
            window.location.href = `payment.html?id=${res.booking.id}`;
          }, 600);
        } else {
          showToast(res.message, 'error');
        }
      });
    }

    renderStep();
  },

  /**
   * Detail Booking / Bukti Reservasi (pages/customer/booking-detail.html)
   */
  initBookingDetail() {
    const container = document.getElementById('booking-detail-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');

    if (!bookingId) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;">ID booking tidak ditemukan.</div>`;
      return;
    }

    const booking = Booking.getById(bookingId);
    if (!booking) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;">Data booking tidak ditemukan di database.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="card" style="max-width:580px;margin:0 auto;padding:2.5rem 2rem;">
        <div style="text-align:center;margin-bottom:2rem;">
          <div style="font-size:0.75rem;color:var(--color-accent);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">BUKTI RESERVASI A3HAIRSTUDIO</div>
          <h1 style="font-size:1.75rem;font-weight:800;margin-top:0.25rem;">${booking.bookingCode}</h1>
          <div style="display:flex;justify-content:center;gap:0.5rem;margin-top:0.75rem;">
            <span class="status-badge status-${booking.bookingStatus.toLowerCase()}">${booking.bookingStatus}</span>
            <span class="status-badge status-${booking.paymentStatus.toLowerCase()}">${booking.paymentStatus}</span>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:1.25rem;border-top:1px dashed var(--color-border);border-bottom:1px dashed var(--color-border);padding:1.5rem 0;">
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--color-text-secondary);font-size:0.875rem;">Nama Pelanggan</span>
            <strong>${booking.customerName} (${booking.customerType})</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--color-text-secondary);font-size:0.875rem;">Nomor Telepon</span>
            <span class="tabular font-bold">${booking.customerPhone}</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--color-text-secondary);font-size:0.875rem;">Layanan</span>
            <strong>${booking.serviceName}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--color-text-secondary);font-size:0.875rem;">Master Kapster</span>
            <strong>${booking.kapsterName}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--color-text-secondary);font-size:0.875rem;">Jadwal Pangkas</span>
            <strong>${formatDate(booking.date)} · ${booking.time} WIB</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:var(--color-text-secondary);font-size:0.875rem;">Metode Bayar</span>
            <strong>${booking.paymentMethod}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:1.125rem;">
            <span style="font-weight:700;">Total Tarif:</span>
            <strong style="color:var(--color-accent);" class="tabular">${formatRupiah(booking.servicePrice)}</strong>
          </div>
        </div>

        <div style="margin-top:2rem;display:flex;flex-direction:column;gap:0.75rem;" class="no-print">
          <button type="button" class="btn btn-outline btn-block" onclick="window.print()" style="justify-content:center;gap:0.5rem;">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Cetak / Simpan Nota Tiket
          </button>
          ${booking.paymentStatus === 'Pending' ? `
            <a href="payment.html?id=${booking.id}" class="btn btn-primary btn-block" style="justify-content:center;">
              Lanjutkan ke Pembayaran &rarr;
            </a>
          ` : ''}
          ${booking.customerType === 'Member' ? `
            <a href="booking-history.html" class="btn btn-outline btn-block" style="justify-content:center;">
              Lihat Riwayat Pemesanan
            </a>
          ` : `
            <a href="booking.html" class="btn btn-primary btn-block" style="justify-content:center;">
              + Pesan Jadwal Pangkas Baru
            </a>
            <a href="../../index.html" class="btn btn-outline btn-block" style="justify-content:center;">
              Kembali ke Beranda Utama
            </a>
          `}
        </div>
      </div>
    `;
  },

  /**
   * Riwayat Pemesanan (pages/customer/booking-history.html)
   */
  initBookingHistory() {
    const tbody = document.getElementById('booking-history-tbody');
    if (!tbody) return;

    const user = Auth.getCurrentUser();
    const isMember = user && user.role === ROLES.MEMBER;
    const allBookings = Booking.getAll();

    let bookings = [];
    if (isMember) {
      bookings = allBookings.filter(b => b.customerId === user.id || b.customerEmail === user.email);
    } else {
      bookings = allBookings.slice(0, 5);
    }

    if (bookings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:3rem;color:var(--color-text-muted);">Belum ada riwayat pemesanan.</td></tr>`;
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><strong class="tabular" style="font-size:0.875rem;">${b.bookingCode}</strong></td>
        <td><strong>${b.serviceName}</strong></td>
        <td>${b.kapsterName}</td>
        <td>
          <div>${formatDate(b.date)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-muted);">${b.time} WIB</div>
        </td>
        <td>
          <span class="status-badge status-${b.paymentStatus.toLowerCase()}">${b.paymentStatus}</span>
        </td>
        <td>
          <span class="status-badge status-${b.bookingStatus.toLowerCase()}">${b.bookingStatus}</span>
        </td>
        <td>
          <div class="row-actions">
            <a href="booking-detail.html?id=${b.id}" class="btn btn-outline btn-sm">Detail</a>
            ${b.paymentStatus === 'Pending' ? `
              <a href="payment.html?id=${b.id}" class="btn btn-primary btn-sm">Bayar</a>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Halaman Pembayaran (pages/customer/payment.html)
   */
  initPaymentPage() {
    const container = document.getElementById('payment-container');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');

    if (!bookingId) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;">ID booking tidak ditemukan.</div>`;
      return;
    }

    const booking = Booking.getById(bookingId);
    if (!booking) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;">Data booking tidak ditemukan.</div>`;
      return;
    }

    function renderPaymentView() {
      container.innerHTML = `
        <div class="card" style="max-width:540px;margin:0 auto;padding:2.5rem 2rem;">
          <div style="text-align:center;margin-bottom:1.75rem;">
            <div style="font-size:0.75rem;color:var(--color-accent);font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">PEMBAYARAN RESERVASI</div>
            <h1 style="font-size:1.75rem;font-weight:800;margin-top:0.25rem;">${formatRupiah(booking.servicePrice)}</h1>
            <p style="font-size:0.875rem;color:var(--color-text-secondary);margin-top:0.35rem;">
              Kode: <strong>${booking.bookingCode}</strong> · Layanan: ${booking.serviceName}
            </p>
          </div>

          ${booking.paymentStatus === 'Success' ? `
            <div style="text-align:center;padding:2rem 1rem;">
              <div style="width:64px;height:64px;background:#ECFDF3;color:#1E6B39;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 1rem;">✓</div>
              <h2 style="font-size:1.25rem;font-weight:800;">Pembayaran Berhasil!</h2>
              <p style="font-size:0.875rem;color:var(--color-text-secondary);margin-top:0.5rem;">
                Terima kasih! Reservasi Anda telah lunas.
                ${booking.customerType === 'Member' ? '<br><strong style="color:var(--color-accent);">★ +10 Poin Loyalitas telah ditambahkan ke saldo Member Anda!</strong>' : ''}
              </p>
              <div style="margin-top:2rem;">
                <a href="booking-detail.html?id=${booking.id}" class="btn btn-primary btn-block" style="justify-content:center;">
                  Lihat Detail Reservasi &rarr;
                </a>
              </div>
            </div>
          ` : `
            <div>
              ${booking.paymentMethod === 'Cash' ? `
                <div style="background:var(--color-surface-subtle);border-radius:var(--radius-small);padding:1.5rem;text-align:center;margin-bottom:1.5rem;">
                  <div style="font-size:2.5rem;margin-bottom:0.5rem;">💵</div>
                  <h3 style="font-size:1.125rem;font-weight:700;">Bayar Tunai di Kasir</h3>
                  <p style="font-size:0.8125rem;color:var(--color-text-secondary);margin-top:0.35rem;">
                    Tunjukkan kode <strong>${booking.bookingCode}</strong> ke kasir saat Anda tiba di A3HAIRSTUDIO.
                  </p>
                </div>
              ` : ''}

              ${booking.paymentMethod === 'QRIS' ? `
                <div style="text-align:center;margin-bottom:1.5rem;">
                  <div class="qris-box" style="margin:0 auto 1rem;">
                    <!-- Simulasi Tampilan QR Code SVG Sederhana -->
                    <svg width="180" height="180" viewBox="0 0 180 180" fill="none" style="background:#FFF;padding:10px;border-radius:8px;border:1px solid var(--color-border);">
                      <rect width="180" height="180" fill="#FFFFFF"/>
                      <rect x="20" y="20" width="40" height="40" fill="#1C1917"/>
                      <rect x="30" y="30" width="20" height="20" fill="#FFFFFF"/>
                      <rect x="120" y="20" width="40" height="40" fill="#1C1917"/>
                      <rect x="130" y="30" width="20" height="20" fill="#FFFFFF"/>
                      <rect x="20" y="120" width="40" height="40" fill="#1C1917"/>
                      <rect x="30" y="130" width="20" height="20" fill="#FFFFFF"/>
                      <rect x="80" y="30" width="20" height="20" fill="#1C1917"/>
                      <rect x="80" y="80" width="20" height="20" fill="#A3783E"/>
                      <rect x="130" y="80" width="20" height="20" fill="#1C1917"/>
                      <rect x="80" y="130" width="20" height="20" fill="#1C1917"/>
                    </svg>
                  </div>
                  <div style="font-weight:700;font-size:0.9375rem;">Scan QRIS A3HAIRSTUDIO</div>
                  <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem;">Mendukung seluruh aplikasi dompet digital & m-banking</div>
                </div>
              ` : ''}

              ${booking.paymentMethod === 'Virtual Account' ? `
                <div style="background:var(--color-surface-subtle);border-radius:var(--radius-small);padding:1.5rem;margin-bottom:1.5rem;">
                  <div style="font-size:0.75rem;color:var(--color-text-muted);text-transform:uppercase;">Nomor Virtual Account Mandiri / BCA</div>
                  <div style="font-size:1.5rem;font-weight:800;color:var(--color-accent);margin:0.5rem 0;" class="tabular">
                    ${Payment.generateVANumber(booking.bookingCode)}
                  </div>
                  <div style="font-size:0.8125rem;color:var(--color-text-secondary);">
                    Total Tagihan: <strong>${formatRupiah(booking.servicePrice)}</strong>
                  </div>
                </div>
              ` : ''}

              <!-- Tombol Simulasi Bayar Berhasil untuk pengujian -->
              <div style="display:flex;flex-direction:column;gap:0.75rem;">
                <button type="button" class="btn btn-primary btn-block" id="btn-simulate-pay-success" style="justify-content:center;">
                  Simulasikan Pembayaran Berhasil &rarr;
                </button>
                <a href="booking-detail.html?id=${booking.id}" class="btn btn-outline btn-block" style="justify-content:center;">
                  Lihat Nota Pemesanan
                </a>
              </div>
            </div>
          `}
        </div>
      `;

      document.getElementById('btn-simulate-pay-success')?.addEventListener('click', () => {
        const res = Payment.confirmPayment(booking.id, 'Simulasi Pengguna');
        if (res.success) {
          showToast('Pembayaran berhasil dikonfirmasi!', 'success');
          booking.paymentStatus = 'Success';
          renderPaymentView();
        }
      });
    }

    renderPaymentView();
  },

  /**
   * Dasbor Member (pages/customer/dashboard.html)
   */
  initCustomerDashboard() {
    Auth.requireMember('/pages/customer/login.html');
    const user = Auth.getCurrentUser();
    if (!user) return;

    const points = Loyalty.getMemberPoints(user.id);
    const bookings = Booking.getByMemberId(user.id);

    const nameEl = document.getElementById('dash-member-name');
    const pointsEl = document.getElementById('dash-member-points');
    const totalBookingsEl = document.getElementById('dash-total-bookings');
    const tbody = document.getElementById('dash-recent-bookings-tbody');

    if (nameEl) nameEl.textContent = user.name;
    if (pointsEl) pointsEl.textContent = `${points} Pts`;
    if (totalBookingsEl) totalBookingsEl.textContent = bookings.length;

    if (tbody) {
      if (bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">Belum ada riwayat booking. Silakan klik menu Pesan Jadwal.</td></tr>`;
      } else {
        tbody.innerHTML = bookings.slice(0, 5).map(b => `
          <tr>
            <td><strong class="tabular">${b.bookingCode}</strong></td>
            <td><strong>${b.serviceName}</strong></td>
            <td>${b.kapsterName}</td>
            <td>${formatDate(b.date)} · ${b.time}</td>
            <td><span class="status-badge status-${b.paymentStatus.toLowerCase()}">${b.paymentStatus}</span></td>
            <td><a href="booking-detail.html?id=${b.id}" class="btn btn-outline btn-sm">Lihat</a></td>
          </tr>
        `).join('');
      }
    }
  },

  /**
   * Halaman Program Loyalty Point (pages/customer/loyalty.html)
   */
  initLoyaltyPage() {
    Auth.requireMember('/pages/customer/login.html');
    const user = Auth.getCurrentUser();
    if (!user) return;

    const points = Loyalty.getMemberPoints(user.id);
    const history = Loyalty.getPointsHistory(user.id);

    const balanceEl = document.getElementById('loyalty-current-balance');
    const historyTbody = document.getElementById('loyalty-history-tbody');

    if (balanceEl) balanceEl.textContent = `${points} Poin`;

    if (historyTbody) {
      if (history.length === 0) {
        historyTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">Belum ada riwayat mutasi poin. Selesaikan booking pertama Anda untuk mendapatkan 10 poin!</td></tr>`;
      } else {
        historyTbody.innerHTML = history.map(h => `
          <tr>
            <td class="tabular">${h.date}</td>
            <td>${h.description}</td>
            <td><span class="status-badge ${h.points > 0 ? 'status-success' : 'status-pending'}">${h.type === 'earned' ? 'Diperoleh' : 'Ditukar'}</span></td>
            <td>
              <strong class="tabular" style="color:${h.points > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
                ${h.points > 0 ? '+' : ''}${h.points} Pts
              </strong>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  /**
   * Katalog Hadiah / Rewards Member (pages/customer/rewards.html)
   */
  initRewardsCatalog() {
    Auth.requireMember('/pages/customer/login.html');
    const user = Auth.getCurrentUser();
    if (!user) return;

    const points = Loyalty.getMemberPoints(user.id);
    const balanceEl = document.getElementById('user-reward-points');
    if (balanceEl) balanceEl.textContent = `${points} Pts`;

    const rewards = Rewards.getAll().filter(r => r.active);
    const gridEl = document.getElementById('rewards-grid-container');

    if (gridEl) {
      gridEl.innerHTML = rewards.map(r => {
        const canRedeem = points >= r.pointsCost && r.stock > 0;
        return `
          <div class="reward-card">
            <div class="reward-badge">★ ${r.pointsCost} Poin</div>
            <div style="flex:1;">
              <h3 style="font-size:1.125rem;font-weight:700;margin-top:0.5rem;">${r.name}</h3>
              <p style="font-size:0.875rem;color:var(--color-text-secondary);margin:0.5rem 0 1rem;line-height:1.5;">${r.description}</p>
              <div style="font-size:0.75rem;color:var(--color-text-muted);">
                Sisa Stok: <strong style="color:${r.stock > 0 ? 'var(--color-primary)' : 'var(--color-danger)'};">${r.stock} pcs</strong>
              </div>
            </div>
            <div style="margin-top:1.25rem;">
              <button type="button" class="btn ${canRedeem ? 'btn-primary' : 'btn-outline'} btn-block btn-redeem-action" data-id="${r.id}" ${canRedeem ? '' : 'disabled'}>
                ${r.stock <= 0 ? 'Stok Habis' : (points < r.pointsCost ? `Kurang ${r.pointsCost - points} Pts` : 'Klaim Hadiah Ini')}
              </button>
            </div>
          </div>
        `;
      }).join('');

      document.querySelectorAll('.btn-redeem-action:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
          const reward = Rewards.getById(btn.dataset.id);
          if (confirm(`Tukarkan ${reward.pointsCost} poin untuk "${reward.name}"? Permintaan akan menunggu persetujuan Owner.`)) {
            const res = Rewards.requestRedemption(user, reward.id);
            if (res.success) {
              showToast('Klaim berhasil diajukan! Status: Pending (Menunggu Persetujuan Owner).', 'success');
              setTimeout(() => {
                window.location.href = 'redemption-history.html';
              }, 600);
            } else {
              showToast(res.message, 'error');
            }
          }
        });
      });
    }
  },

  /**
   * Riwayat Penukaran Hadiah (pages/customer/redemption-history.html)
   */
  initRedemptionHistory() {
    Auth.requireMember('/pages/customer/login.html');
    const user = Auth.getCurrentUser();
    if (!user) return;

    const list = Rewards.getRedemptions(user.id);
    const tbody = document.getElementById('redemption-history-tbody');

    if (tbody) {
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2.5rem;color:var(--color-text-muted);">Belum ada riwayat penukaran hadiah. Kunjungi Katalog Hadiah untuk menukar poin Anda.</td></tr>`;
      } else {
        tbody.innerHTML = list.map(item => `
          <tr>
            <td class="tabular"><strong>${item.id}</strong></td>
            <td><strong>${item.rewardName}</strong></td>
            <td class="tabular" style="color:var(--color-accent);font-weight:700;">★ ${item.pointsSpent} Pts</td>
            <td class="tabular">${item.createdAt}</td>
            <td><span class="status-badge status-${item.status.toLowerCase()}">${item.status}</span></td>
            <td>
              <span style="font-size:0.8125rem;color:var(--color-text-secondary);">
                ${item.status === 'Pending' ? 'Menunggu persetujuan kasir' : ''}
                ${item.status === 'Approved' ? 'Siap diambil di studio fisik!' : ''}
                ${item.status === 'Completed' ? 'Selesai diambil' : ''}
                ${item.status === 'Rejected' ? (item.rejectReason || 'Ditolak') : ''}
              </span>
            </td>
          </tr>
        `).join('');
      }
    }
  },

  /**
   * Profil Pelanggan (pages/customer/profile.html)
   */
  initCustomerProfile() {
    Auth.requireMember('/pages/customer/login.html');
    const user = Auth.getCurrentUser();
    if (!user) return;

    const members = Storage.get(STORAGE_KEYS.MEMBERS, []);
    const member = members.find(m => m.id === user.id) || user;

    const nameInput = document.getElementById('prof-name');
    const emailInput = document.getElementById('prof-email');
    const phoneInput = document.getElementById('prof-phone');
    const pointsEl = document.getElementById('prof-points-badge');

    if (nameInput) nameInput.value = member.name || '';
    if (emailInput) emailInput.value = member.email || '';
    if (phoneInput) phoneInput.value = member.phone || '';
    if (pointsEl) pointsEl.textContent = `★ ${member.points || 0} Pts`;

    document.getElementById('profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      member.name = nameInput.value.trim();
      member.phone = phoneInput.value.trim();

      const idx = members.findIndex(m => m.id === member.id);
      if (idx !== -1) {
        members[idx] = member;
        Storage.set(STORAGE_KEYS.MEMBERS, members);
      }

      Auth.setCurrentUser({
        ...user,
        name: member.name,
        phone: member.phone
      });

      showToast('Profil berhasil diperbarui!', 'success');
    });
  }
};
