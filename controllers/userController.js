// controllers/userController.js
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const asyncHandler = require('../middleware/asyncHandler');
const { sendNotificationToUser } = require('../services/notification_service'); // Impor service notifikasi

// @desc    Mendaftarkan pengguna baru
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('Email sudah terdaftar');
  }
  const user = await User.create({ name, email, password });
  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Data pengguna tidak valid');
  }
});

// @desc    Login pengguna & mendapatkan token
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    // ================== PERUBAHAN PENTING (1/2) ==================
    // Logika pengiriman notifikasi DIHAPUS dari sini untuk
    // memperbaiki race condition. Backend sekarang hanya fokus
    // memberikan token otentikasi.
    // =============================================================

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Email atau password salah');
  }
});

// @desc    Mendaftarkan atau memperbarui FCM token untuk pengguna
const registerFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    res.status(400);
    throw new Error('Token tidak ditemukan di body request');
  }
  const user = await User.findById(req.user._id);

  if (user) {
    const isNewToken = !user.fcmTokens.includes(token);

    // Simpan token ke database
    user.fcmTokens = [...new Set([...user.fcmTokens, token])];
    await user.save();
    
    // ================== PERUBAHAN PENTING (2/2) ==================
    // Notifikasi "Selamat Datang" sekarang dikirim dari sini,
    // SETELAH token berhasil disimpan.
    // Ini juga hanya akan dikirim jika token tersebut baru,
    // untuk menghindari spam setiap kali pengguna membuka aplikasi.
    if (isNewToken) {
      await sendNotificationToUser(
        user._id,
        'Selamat Datang di DigiHome!',
        `Akun Anda sekarang siap untuk menerima notifikasi di perangkat ini.`
      );
    }
    // =============================================================

    res.status(200).json({ message: 'Token berhasil disimpan' });
  } else {
    res.status(404);
    throw new Error('Pengguna tidak ditemukan');
  }
});

const testBudgetNotification = asyncHandler(async (req, res) => {
  // Untuk menyederhanakan, kita panggil fungsi yang sama dengan yang dijalankan cron
  // NOTE: Anda perlu mengekspor checkUserBudgets dari scheduler_service.js
  // Jika belum, untuk sementara kita bisa pindahkan logikanya ke sini.
  // Mari kita asumsikan kita akan memindahkannya ke service terpisah nanti.
  // Untuk sekarang, kita panggil dummy function.
  
  // Kirim notifikasi tes langsung ke pengguna yang sedang login
  await sendNotificationToUser(
    req.user._id, 
    'Uji Coba Notifikasi Budget', 
    'Jika Anda melihat ini, maka pemicu notifikasi berfungsi!'
  );

  res.status(200).json({ message: 'Perintah tes notifikasi budget telah dijalankan.' });
});

module.exports = {
  registerUser,
  loginUser,
  registerFcmToken,
  testBudgetNotification,
};
