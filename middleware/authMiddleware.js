const jwt = require('jsonwebtoken');
const User = require('../models/User.js');

const protect = async (req, res, next) => {
  let token;

  // Cek jika header Authorization ada dan dimulai dengan 'Bearer'
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Ambil token dari header (Contoh: "Bearer <token_panjang>", kita hanya ambil bagian tokennya)
      token = req.headers.authorization.split(' ')[1];

      // 2. Verifikasi keaslian token menggunakan secret key kita
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Jika token valid, ambil data pengguna dari database berdasarkan ID di dalam token
      //    Kita tidak menyertakan password saat mengambil data (`.select('-password')`)
      req.user = await User.findById(decoded.id).select('-password');

      // 4. Lanjutkan ke fungsi controller selanjutnya (misalnya, getDevices)
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Tidak terotorisasi, token gagal' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Tidak terotorisasi, tidak ada token' });
  }
};

module.exports = { protect };
