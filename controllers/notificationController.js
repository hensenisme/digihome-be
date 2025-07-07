// controllers/notificationController.js
const Notification = require('../models/Notification');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Mengambil semua notifikasi untuk pengguna yang sedang login.
 * @route   GET /api/notifications
 * @access  Private
 */
const getUserNotifications = asyncHandler(async (req, res) => {
  // --- BLOK DEBUGGING & PERBAIKAN ---
  // Log 1: Verifikasi bahwa middleware 'protect' telah berjalan dengan benar.
  if (!req.user || !req.user._id) {
    console.error('[Debug] FATAL: req.user atau req.user._id tidak ditemukan. Middleware `protect` mungkin gagal atau token tidak valid.');
    // Kirim respons error yang jelas jika pengguna tidak terautentikasi.
    res.status(401);
    throw new Error('User tidak terautentikasi dengan benar.');
  }
  
  console.log(`[Debug] Mencoba mengambil notifikasi untuk user ID: ${req.user._id}`);

  try {
    // Log 2: Jalankan query ke database dengan user ID yang sudah divalidasi.
    console.log(`[Debug] Menjalankan query: Notification.find({ user: "${req.user._id}" })`);
    const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 });
    
    // Log 3: Laporkan hasilnya dan kirim respons sukses.
    console.log(`[Debug] Ditemukan ${notifications.length} notifikasi untuk pengguna ${req.user._id}.`);
    res.status(200).json(notifications);

  } catch (error) {
    // Log 4: Tangkap error spesifik dari database atau proses lainnya.
    console.error(`[Debug] Terjadi error saat query database untuk user ${req.user._id}:`, error);
    res.status(500); // Set status ke 500 Internal Server Error
    throw new Error('Terjadi kesalahan pada server saat mengambil notifikasi.');
  }
});


/**
 * @desc    Menandai satu notifikasi sebagai sudah dibaca.
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = asyncHandler(async (req, res) => {
  // Pastikan req.user ada sebelum melanjutkan
  if (!req.user || !req.user._id) {
    res.status(401);
    throw new Error('User tidak terautentikasi.');
  }

  const notification = await Notification.findById(req.params.id);

  // Pastikan notifikasi ada dan dimiliki oleh pengguna yang sedang login
  if (notification && notification.user.toString() === req.user._id.toString()) {
    notification.isRead = true;
    await notification.save();
    res.json({ message: 'Notification marked as read' });
  } else {
    res.status(404);
    throw new Error('Notification not found or you are not authorized');
  }
});

module.exports = { getUserNotifications, markAsRead };
