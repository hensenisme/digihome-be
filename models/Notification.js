// models/Notification.js
const mongoose = require('mongoose');

/**
 * Skema untuk menyimpan riwayat notifikasi yang dikirim ke pengguna.
 * Ini memungkinkan aplikasi untuk menampilkan halaman riwayat notifikasi.
 */
const notificationSchema = new mongoose.Schema(
  {
    // Referensi ke pengguna yang menerima notifikasi
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    // Judul notifikasi yang ditampilkan
    title: {
      type: String,
      required: true,
    },
    // Isi pesan notifikasi
    body: {
      type: String,
      required: true,
    },
    // Menyimpan data tambahan (payload) yang dikirim bersama notifikasi.
    // Berguna untuk navigasi di aplikasi (misal: membuka halaman detail perangkat tertentu).
    dataPayload: {
      type: Map,
      of: String,
    },
    // Menandai apakah notifikasi sudah dibaca oleh pengguna atau belum.
    isRead: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    // Secara otomatis menambahkan field `createdAt` dan `updatedAt`
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
