// services/notification_service.js
const admin = require('firebase-admin');
const User = require('../models/User');
const Notification = require('../models/Notification'); // <-- BARU

try {
  const serviceAccount = require('../firebase-service-account_digihome.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log('[FCM] Firebase Admin SDK berhasil diinisialisasi.');
} catch (error) {
  console.error(
    '[FCM] GAGAL inisialisasi Firebase Admin SDK. Pastikan file "firebase-service-account_digihome.json" ada dan path-nya benar.',
    error.message
  );
}

// /**
//  * Mengirim notifikasi ke semua perangkat milik satu pengguna dan menyimpannya ke database.
//  * @param {string} userId ID pengguna (dari MongoDB) yang akan dikirimi notifikasi.
//  * @param {string} title Judul notifikasi.
//  * @param {string} body - Isi pesan notifikasi.
//  * @param {object} [data={}] - Data tambahan yang ingin dikirim (misal: deviceId).
//  */
async function sendNotificationToUser(userId, title, body, data = {}) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`[FCM] Pengguna ${userId} tidak memiliki token untuk dikirimi notifikasi.`);
      return;
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: user.fcmTokens,
      data: data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'high_importance_channel',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Berhasil mengirim notifikasi ke ${response.successCount} token untuk pengguna ${userId}`);

    // --- BLOK BARU: Simpan notifikasi ke database ---
    // Ini dieksekusi HANYA jika pengiriman FCM berhasil
    if (response.successCount > 0) {
      await Notification.create({
        user: userId,
        title: title,
        body: body,
        dataPayload: data,
      });
      console.log(`[Notification] Notifikasi untuk user ${userId} juga disimpan ke DB.`);
    }
    // --- AKHIR BLOK BARU ---

    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          tokensToRemove.push(user.fcmTokens[idx]);
        }
      });
      console.log(`[FCM] Menghapus token tidak valid: ${tokensToRemove}`);
      await User.updateOne({ _id: userId }, { $pullAll: { fcmTokens: tokensToRemove } });
    }
  } catch (error) {
    console.error(`[FCM] Gagal mengirim atau menyimpan notifikasi ke pengguna ${userId}:`, error);
  }
}

module.exports = { sendNotificationToUser };
