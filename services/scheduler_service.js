// services/scheduler_service.js
const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Device = require('../models/Device');
const { WebSocket } = require('ws');

// ================== SOLUSI BAGIAN 1: Impor Fungsi MQTT ==================
// Kita perlu mengimpor fungsi publishMqttMessage agar service ini bisa
// mengirim perintah ke perangkat keras.
const { publishMqttMessage } = require('./mqtt_service');
// =======================================================================

// Helper untuk memetakan nama hari ke angka (Minggu=0, Senin=1,...)
const dayMap = {
  Min: 0,
  Sen: 1,
  Sel: 2,
  Rab: 3,
  Kam: 4,
  Jum: 5,
  Sab: 6,
};

/**
 * Memulai Scheduler Engine yang berjalan setiap menit.
 * @param {Map<string, WebSocket>} clientConnections Map dari userId ke koneksi WebSocket.
 */
const startScheduler = (clientConnections) => {
  console.log('[Scheduler] Engine is running. Checking for tasks every minute.');

  // Jadwalkan tugas untuk berjalan setiap menit: '* * * * *'
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentDay = Object.keys(dayMap).find(
      (key) => dayMap[key] === now.getDay()
    );
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    console.log(
      `[Scheduler] Checking for tasks at ${currentTime} on ${currentDay}...`
    );

    try {
      // Cari semua jadwal yang aktif, cocok dengan hari dan waktu saat ini
      const dueSchedules = await Schedule.find({
        isEnabled: true,
        days: currentDay,
        $or: [{ startTime: currentTime }, { endTime: currentTime }],
      });

      if (dueSchedules.length === 0) {
        return; // Tidak ada tugas, selesai untuk menit ini.
      }

      console.log(`[Scheduler] Found ${dueSchedules.length} due tasks.`);

      for (const schedule of dueSchedules) {
        // ================== SOLUSI BAGIAN 2: Perbaikan Logika Target State ==================
        // Logika ini diperbaiki agar lebih jelas dan benar.
        // Jika waktu saat ini adalah waktu mulai, gunakan aksi dari jadwal.
        // Jika waktu saat ini adalah waktu selesai, lakukan aksi kebalikannya.
        let targetState;
        if (schedule.startTime === currentTime) {
          targetState = schedule.action === 'ON'; // true jika ON, false jika OFF
        } else {
          // Ini adalah endTime, lakukan aksi kebalikan
          targetState = !(schedule.action === 'ON'); // true jika action OFF, false jika action ON
        }
        // ===================================================================================

        const device = await Device.findOne({
          deviceId: schedule.deviceId,
          owner: schedule.owner,
        });

        if (!device) {
          console.log(
            `[Scheduler] Device ${schedule.deviceId} not found for schedule ${schedule._id}`
          );
          continue;
        }

        // Hanya eksekusi jika status perangkat berbeda dengan target
        if (device.active !== targetState) {
          device.active = targetState;
          await device.save();

          console.log(
            `[Scheduler] Executed DB update: Set device ${
              device.name
            } to ${targetState ? 'ON' : 'OFF'}`
          );
          
          // ================== SOLUSI BAGIAN 3: Kirim Perintah MQTT ==================
          // Ini adalah bagian terpenting yang hilang.
          // Kirim perintah ke perangkat keras melalui MQTT.
          const topic = `digihome/devices/${device.deviceId}/command`;
          const message = {
            action: 'SET_STATUS',
            payload: targetState ? 'ON' : 'OFF',
          };
          publishMqttMessage(topic, message);
          console.log(`[Scheduler] Published MQTT command to ${topic}`);
          // ==========================================================================

          // Kirim pembaruan real-time ke pengguna yang tepat (sudah benar)
          const ownerSocket = clientConnections.get(device.owner.toString());
          if (ownerSocket && ownerSocket.readyState === WebSocket.OPEN) {
            const payload = JSON.stringify({
              deviceId: device.deviceId,
              timestamp: new Date().toISOString(),
              power: targetState ? Math.random() * 50 + 10 : 0,
              voltage: 220,
              current: targetState ? Math.random() * 0.5 : 0,
              energyKWh: device.energyKWh || 0,
              powerFactor: 0.9,
              active: targetState,
            });
            ownerSocket.send(payload);
            console.log(
              `[Scheduler] Notified user ${device.owner} about status change.`
            );
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error during task execution:', error);
    }
  });
};

module.exports = { startScheduler };
