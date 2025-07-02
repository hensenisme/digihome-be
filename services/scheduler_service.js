// services/scheduler_service.js
const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Device = require('../models/Device');
const { WebSocket } = require('ws');
const { publishMqttMessage } = require('./mqtt_service');

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

  // =================================================================
  // ================== SOLUSI ZONA WAKTU (ISSUE #1) =================
  // Tambahkan opsi 'timezone' agar cron berjalan sesuai Waktu Indonesia Barat.
  cron.schedule(
    '* * * * *',
    async () => {
      const now = new Date();
      const currentDay = Object.keys(dayMap).find(
        (key) => dayMap[key] === now.getDay()
      );
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;

      console.log(
        `[Scheduler] Checking for tasks at ${currentTime} on ${currentDay} (Timezone: Asia/Jakarta)...`
      );

      try {
        const dueSchedules = await Schedule.find({
          isEnabled: true,
          days: currentDay,
          $or: [{ startTime: currentTime }, { endTime: currentTime }],
        });

        if (dueSchedules.length === 0) {
          return;
        }

        console.log(`[Scheduler] Found ${dueSchedules.length} due tasks.`);

        for (const schedule of dueSchedules) {
          let targetState;
          if (schedule.startTime === currentTime) {
            targetState = schedule.action === 'ON';
          } else {
            targetState = !(schedule.action === 'ON');
          }

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

          if (device.active !== targetState) {
            device.active = targetState;
            await device.save();

            console.log(
              `[Scheduler] Executed DB update: Set device ${
                device.name
              } to ${targetState ? 'ON' : 'OFF'}`
            );

            const topic = `digihome/devices/${device.deviceId}/command`;
            const message = {
              action: 'SET_STATUS',
              payload: targetState ? 'ON' : 'OFF',
            };
            publishMqttMessage(topic, message);
            console.log(`[Scheduler] Published MQTT command to ${topic}`);

            const ownerSocket = clientConnections.get(device.owner.toString());
            if (ownerSocket && ownerSocket.readyState === WebSocket.OPEN) {
              // =================================================================
              // =========== SOLUSI PAYLOAD WEBSOCKET (ISSUE #2 & #3) ============
              // Ubah payload agar sesuai dengan yang diharapkan PowerLog.fromJson di aplikasi.
              // Gunakan field "status" dengan nilai "ON" atau "OFF".
              const payload = JSON.stringify({
                deviceId: device.deviceId,
                timestamp: new Date().toISOString(),
                power: targetState ? Math.random() * 50 + 10 : 0,
                voltage: 220,
                current: targetState ? Math.random() * 0.5 : 0,
                energyKWh: 0, // Nilai energi tidak relevan untuk update status
                powerFactor: 0.9,
                status: targetState ? 'ON' : 'OFF', // INI PERUBAHANNYA
              });
              // =================================================================

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
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta', // INI PENAMBAHANNYA
    }
  );
};

module.exports = { startScheduler };
