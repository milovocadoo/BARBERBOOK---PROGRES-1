/**
 * ============================================================================
 * common.js — FUNGSI UMUM & DASAR BARBERBOOK A3HAIRSTUDIO
 * ============================================================================
 * File ini berisi fungsi-fungsi dasar yang digunakan bersama oleh seluruh halaman:
 * 1. Kunci & Pengelolaan LocalStorage
 * 2. Data Awal Default (Layanan, Kapster, Jam Operasional, Akun)
 * 3. Otentikasi & Manajemen Sesi (Guest, Member, Owner)
 * 4. Fungsi Format Rupiah & Format Tanggal
 * 5. Notifikasi Toast
 * ============================================================================
 */

/* ============================================================================
 * 1. KUNCI LOCALSTORAGE & FUNGSI STORAGE SEDERHANA
 * ============================================================================
 */
export const STORAGE_KEYS = {
  SERVICES: 'a3_barberbook_services',              // Data layanan & tarif
  KAPSTERS: 'a3_barberbook_kapsters',              // Data kapster
  BOOKINGS: 'a3_barberbook_bookings',              // Data seluruh reservasi
  LOYALTY_CONFIG: 'a3_barberbook_loyalty_config',  // Aturan poin member
  POINTS_HISTORY: 'a3_barberbook_points_history',  // Riwayat mutasi poin
  REWARDS: 'a3_barberbook_rewards',                // Katalog hadiah
  REDEMPTIONS: 'a3_barberbook_redemptions',        // Riwayat klaim hadiah
  OPERATIONAL: 'a3_barberbook_operational',        // Informasi jam buka & alamat studio
  CURRENT_USER: 'a3_barberbook_current_user',      // Sesi pengguna yang sedang login
  MEMBERS: 'a3_barberbook_members'                 // Data akun member terdaftar
};

/**
 * Mengambil data dari LocalStorage. Jika belum ada data, kembalikan nilai default.
 */
export function getStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    if (data === null || data === undefined) {
      return defaultValue;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Gagal membaca ${key} dari LocalStorage:`, error);
    return defaultValue;
  }
}

/**
 * Menyimpan data ke LocalStorage.
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Gagal menyimpan ${key} ke LocalStorage:`, error);
    return false;
  }
}

/**
 * Menghapus data dari LocalStorage berdasarkan kuncinya.
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Gagal menghapus ${key} dari LocalStorage:`, error);
    return false;
  }
}

// Objek Storage untuk kemudahan pemanggilan
export const Storage = {
  get: getStorage,
  set: setStorage,
  remove: removeStorage
};


/* ============================================================================
 * 2. DATA AWAL (DEFAULT INITIAL DATA)
 * ============================================================================
 */
export const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00', '20:00'
];

export const INITIAL_SERVICES = [
  {
    id: 'srv-1',
    name: 'Signature Haircut & Wash',
    category: 'Haircut',
    duration: 45,
    price: 75000,
    description: 'Potongan rambut presisi dengan konsultasi gaya, cuci rambut relaksasi, handuk hangat, dan styling pomade premium.',
    active: true
  },
  {
    id: 'srv-2',
    name: 'Classic Gentleman Cut',
    category: 'Haircut',
    duration: 35,
    price: 60000,
    description: 'Potongan rambut rapi klasik (fade, pompadour, side part) sudah termasuk cukur kumis/jenggot ringan dan styling.',
    active: true
  },
  {
    id: 'srv-3',
    name: 'Beard Grooming & Hot Towel',
    category: 'Grooming',
    duration: 30,
    price: 45000,
    description: 'Perapian jenggot dan kumis profesional dengan ritual handuk hangat aromaterapi dan essential beard oil.',
    active: true
  },
  {
    id: 'srv-4',
    name: 'Hair Spa & Scalp Detox',
    category: 'Treatment',
    duration: 50,
    price: 90000,
    description: 'Pijat relaksasi kulit kepala intensif untuk membersihkan ketombe, memperlancar sirkulasi, dan menguatkan akar rambut.',
    active: true
  },
  {
    id: 'srv-5',
    name: 'Gentleman Complete Package',
    category: 'Package',
    duration: 75,
    price: 135000,
    description: 'Paket lengkap: Signature Haircut + Cuci Rambut + Beard Grooming + Scalp Massage + Styling Pomade.',
    active: true
  }
];

export const INITIAL_KAPSTERS = [
  {
    id: 'kp-1',
    name: 'Rian',
    specialty: 'Classic Taper & Pompadour',
    experience: '8 Tahun',
    bio: 'Master barber berpengalaman dalam gaya klasik formal dan razor fade tajam.',
    avatar: 'R',
    active: true
  },
  {
    id: 'kp-2',
    name: 'Bayu',
    specialty: 'Skin Fade & Modern Crop',
    experience: '5 Tahun',
    bio: 'Spesialis potongan modern bertekstur, low/mid/high taper fade, dan buzz cut kekinian.',
    avatar: 'B',
    active: true
  },
  {
    id: 'kp-3',
    name: 'Dimas',
    specialty: 'Beard Shaping & Scalp Treatment',
    experience: '6 Tahun',
    bio: 'Ahli penataan jenggot proporsional dan perawatan kulit kepala relaksasi.',
    avatar: 'D',
    active: true
  }
];

export const INITIAL_REWARDS = [
  {
    id: 'rwd-1',
    name: 'A3 Matte Clay Pomade 100g',
    pointsCost: 50,
    stock: 15,
    description: 'Pomade matte hold kuat dengan aroma vanilla woody, mudah dibilas dan tidak lengket.',
    active: true
  },
  {
    id: 'rwd-2',
    name: 'Argan Hair Vitamin Serum 50ml',
    pointsCost: 35,
    stock: 10,
    description: 'Serum rambut diperkaya minyak argan murni untuk melembutkan dan melindungi dari sinar UV.',
    active: true
  },
  {
    id: 'rwd-3',
    name: 'Voucher Potongan Rp 25.000',
    pointsCost: 30,
    stock: 25,
    description: 'Voucher diskon Rp 25.000 untuk kunjungan layanan berikutnya di A3HAIRSTUDIO.',
    active: true
  },
  {
    id: 'rwd-4',
    name: 'Classic Barber Tonic 150ml',
    pointsCost: 40,
    stock: 8,
    description: 'Tonic pendingin kulit kepala dengan ekstrak menthol dan rosemary segar.',
    active: true
  }
];

export const INITIAL_OPERATIONAL = {
  name: 'A3HAIRSTUDIO',
  tagline: 'Modern Gentleman Barbershop & Grooming Studio',
  address: 'JRT.1/RW.5, Pasinan Kulon, Kupang, Kec. Jetis, Kabupaten Mojokerto, Jawa Timur 61352',
  phone: '0812-3456-7890',
  whatsapp: '6281234567890',
  email: 'a3hairstudio@gmail.com',
  openingHours: 'Senin - Minggu: 09:00 - 21:00 WIB',
  instagram: '@a3hairstudio',
  policy: 'Pelanggan disarankan hadir 10 menit sebelum jadwal booking. Keterlambatan lebih dari 15 menit dapat menyebabkan penjadwalan ulang.'
};

export const INITIAL_MEMBERS = [
  {
    id: 'mbr-1',
    name: 'Ardian Rifqi',
    email: 'ardianrifqi05@gmail.com',
    phone: '081298765432',
    points: 40,
    joinedDate: '2026-01-15'
  },
  {
    id: 'mbr-2',
    name: 'Budi Santoso',
    email: 'budi.santoso@gmail.com',
    phone: '081388776655',
    points: 20,
    joinedDate: '2026-02-01'
  }
];

export const INITIAL_BOOKINGS = [
  {
    id: 'BKB-1001',
    bookingCode: 'A3-2026-1001',
    customerType: 'Member',
    customerId: 'mbr-1',
    customerName: 'Ardian Rifqi',
    customerPhone: '081298765432',
    customerEmail: 'ardianrifqi05@gmail.com',
    serviceId: 'srv-1',
    serviceName: 'Signature Haircut & Wash',
    servicePrice: 75000,
    kapsterId: 'kp-1',
    kapsterName: 'Rian "The Classic"',
    date: '2026-11-08',
    time: '10:00',
    paymentMethod: 'QRIS',
    paymentStatus: 'Success',
    bookingStatus: 'Scheduled',
    pointsAwarded: 10,
    createdAt: '2026-11-07T10:15:00'
  },
  {
    id: 'BKB-1002',
    bookingCode: 'A3-2026-1002',
    customerType: 'Guest',
    customerId: null,
    customerName: 'Reza Pratama',
    customerPhone: '081900112233',
    customerEmail: '',
    serviceId: 'srv-2',
    serviceName: 'Classic Gentleman Cut',
    servicePrice: 60000,
    kapsterId: 'kp-2',
    kapsterName: 'Bayu "Fade Specialist"',
    date: '2026-11-08',
    time: '14:00',
    paymentMethod: 'Cash',
    paymentStatus: 'Pending',
    bookingStatus: 'Scheduled',
    pointsAwarded: 0,
    createdAt: '2026-11-07T11:30:00'
  },
  {
    id: 'BKB-1003',
    bookingCode: 'A3-2026-1003',
    customerType: 'Member',
    customerId: 'mbr-2',
    customerName: 'Budi Santoso',
    customerPhone: '081388776655',
    customerEmail: 'budi.santoso@gmail.com',
    serviceId: 'srv-5',
    serviceName: 'Gentleman Complete Package',
    servicePrice: 135000,
    kapsterId: 'kp-3',
    kapsterName: 'Dimas "Style & Grooming"',
    date: '2026-11-07',
    time: '16:00',
    paymentMethod: 'Virtual Account',
    paymentStatus: 'Success',
    bookingStatus: 'Completed',
    pointsAwarded: 10,
    createdAt: '2026-11-06T15:20:00'
  }
];

export const INITIAL_POINTS_HISTORY = [
  {
    id: 'pth-1',
    memberId: 'mbr-1',
    bookingId: 'BKB-1001',
    type: 'earned',
    points: 10,
    description: 'Booking A3-2026-1001 (Signature Haircut & Wash)',
    date: '2026-11-07 10:16'
  },
  {
    id: 'pth-2',
    memberId: 'mbr-1',
    bookingId: null,
    type: 'earned',
    points: 30,
    description: 'Bonus Saldo Member Baru & Reservasi Sebelumnya',
    date: '2026-11-01 14:00'
  },
  {
    id: 'pth-3',
    memberId: 'mbr-2',
    bookingId: 'BKB-1003',
    type: 'earned',
    points: 10,
    description: 'Booking A3-2026-1003 (Gentleman Complete Package)',
    date: '2026-11-07 09:00'
  }
];

export const INITIAL_REDEMPTIONS = [
  {
    id: 'rdm-1',
    memberId: 'mbr-2',
    memberName: 'Budi Santoso',
    memberEmail: 'budi.santoso@gmail.com',
    rewardId: 'rwd-3',
    rewardName: 'Voucher Potongan Rp 25.000',
    pointsSpent: 30,
    status: 'Completed',
    createdAt: '2026-11-05 13:00',
    approvedAt: '2026-11-05 14:00',
    completedAt: '2026-11-06 16:30'
  }
];

/**
 * Inisialisasi data awal ke LocalStorage jika belum ada.
 */
export function initializeSeedData() {
  if (!getStorage(STORAGE_KEYS.SERVICES)) {
    setStorage(STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
  }
  if (!getStorage(STORAGE_KEYS.KAPSTERS)) {
    setStorage(STORAGE_KEYS.KAPSTERS, INITIAL_KAPSTERS);
  }
  if (!getStorage(STORAGE_KEYS.LOYALTY_CONFIG)) {
    setStorage(STORAGE_KEYS.LOYALTY_CONFIG, {
      pointsPerTransaction: 10,
      minRedemptionPoints: 30,
      enabled: true
    });
  }
  if (!getStorage(STORAGE_KEYS.REWARDS)) {
    setStorage(STORAGE_KEYS.REWARDS, INITIAL_REWARDS);
  }
  if (!getStorage(STORAGE_KEYS.OPERATIONAL)) {
    setStorage(STORAGE_KEYS.OPERATIONAL, INITIAL_OPERATIONAL);
  }
  if (!getStorage(STORAGE_KEYS.MEMBERS)) {
    setStorage(STORAGE_KEYS.MEMBERS, INITIAL_MEMBERS);
  }
  if (!getStorage(STORAGE_KEYS.BOOKINGS)) {
    setStorage(STORAGE_KEYS.BOOKINGS, INITIAL_BOOKINGS);
  }
  if (!getStorage(STORAGE_KEYS.POINTS_HISTORY)) {
    setStorage(STORAGE_KEYS.POINTS_HISTORY, INITIAL_POINTS_HISTORY);
  }
  if (!getStorage(STORAGE_KEYS.REDEMPTIONS)) {
    setStorage(STORAGE_KEYS.REDEMPTIONS, INITIAL_REDEMPTIONS);
  }
}

// Jalankan seed data otomatis saat common.js dimuat
initializeSeedData();


/* ============================================================================
 * 3. OTENTIKASI & SESI PENGGUNA (Auth)
 * ============================================================================
 */
export const ROLES = {
  OWNER: 'owner',
  MEMBER: 'member',
  GUEST: 'guest'
};

export const Auth = {
  /**
   * Mengambil user aktif dari LocalStorage
   */
  getCurrentUser() {
    return getStorage(STORAGE_KEYS.CURRENT_USER, null);
  },

  /**
   * Menyimpan user aktif ke LocalStorage
   */
  setCurrentUser(user) {
    return setStorage(STORAGE_KEYS.CURRENT_USER, user);
  },

  /**
   * Login Owner / Kasir
   * Kredensial default: owner@a3hairstudio.com / admin123
   */
  loginOwner(emailOrUsername, password) {
    const valid = [
      { user: 'owner@a3hairstudio.com', pass: 'admin123' },
      { user: 'admin', pass: 'admin123' },
      { user: 'owner', pass: 'owner123' }
    ];

    const match = valid.find(
      c => c.user.toLowerCase() === emailOrUsername.trim().toLowerCase() && c.pass === password
    );

    if (match) {
      const ownerUser = {
        id: 'usr-owner',
        role: ROLES.OWNER,
        name: 'Owner A3HAIRSTUDIO',
        email: 'owner@a3hairstudio.com',
        avatar: 'O'
      };
      this.setCurrentUser(ownerUser);
      return { success: true, user: ownerUser };
    }
    return { success: false, message: 'Email/Username atau password salah. Coba: owner@a3hairstudio.com / admin123' };
  },

  /**
   * Login Member menggunakan Google simulasi
   */
  loginGoogleMember(customEmail = null, customName = null) {
    const members = getStorage(STORAGE_KEYS.MEMBERS, []);
    const targetEmail = customEmail || 'ardianrifqi05@gmail.com';
    let member = members.find(m => m.email.toLowerCase() === targetEmail.toLowerCase());

    if (!member) {
      member = {
        id: 'mbr-' + Date.now().toString(36),
        name: customName || 'Ardian Rifqi',
        email: targetEmail,
        phone: '081298765432',
        points: 0,
        joinedDate: new Date().toISOString().split('T')[0]
      };
      members.push(member);
      setStorage(STORAGE_KEYS.MEMBERS, members);
    }

    const sessionUser = {
      id: member.id,
      role: ROLES.MEMBER,
      name: member.name,
      email: member.email,
      phone: member.phone,
      avatar: member.name.charAt(0).toUpperCase()
    };

    this.setCurrentUser(sessionUser);
    return { success: true, user: sessionUser };
  },

  /**
   * Sesi pelanggan tamu (Guest)
   */
  setGuestSession(name, phone) {
    const guestUser = {
      id: 'gst-' + Date.now().toString(36),
      role: ROLES.GUEST,
      name: name.trim(),
      phone: phone.trim(),
      email: ''
    };
    this.setCurrentUser(guestUser);
    return { success: true, user: guestUser };
  },

  /**
   * Logout menghapus sesi aktif
   */
  logout() {
    removeStorage(STORAGE_KEYS.CURRENT_USER);
  },

  isOwner() {
    const u = this.getCurrentUser();
    return u && u.role === ROLES.OWNER;
  },

  isMember() {
    const u = this.getCurrentUser();
    return u && u.role === ROLES.MEMBER;
  },

  isGuest() {
    const u = this.getCurrentUser();
    return u && u.role === ROLES.GUEST;
  },

  /**
   * Wajib login sebagai Owner
   */
  requireOwner(redirectPath = '/pages/owner/login.html') {
    if (!this.isOwner()) {
      window.location.href = redirectPath;
      return false;
    }
    return true;
  },

  /**
   * Wajib login sebagai Member
   */
  requireMember(redirectPath = '/pages/customer/login.html') {
    if (!this.isMember()) {
      window.location.href = redirectPath;
      return false;
    }
    return true;
  }
};


/* ============================================================================
 * 4. FUNGSI FORMAT RUPIAH & TANGGAL
 * ============================================================================
 */

/**
 * Format angka ke mata uang Rupiah Indonesia (cth: 75000 -> "Rp 75.000")
 */
export function formatRupiah(amount) {
  if (amount === undefined || amount === null) return 'Rp 0';
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

/**
 * Format tanggal YYYY-MM-DD ke teks bahasa Indonesia (cth: "Min, 8 Nov 2026")
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}


/* ============================================================================
 * 5. NOTIFIKASI TOAST MELAYANG
 * ============================================================================
 */
export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="color:rgba(255,255,255,0.7);font-size:1.1rem;margin-left:0.5rem;background:none;border:none;cursor:pointer;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }
  }, 4000);
}

// Inisialisasi global untuk mempermudah akses
if (typeof window !== 'undefined') {
  window.BarberBook = {
    formatRupiah,
    formatDate,
    showToast,
    Storage,
    Auth
  };
}
