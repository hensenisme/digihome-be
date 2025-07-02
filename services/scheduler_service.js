// services/scheduler_service.js
const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Device = require('../models/Device');
const { WebSocket } = require('ws');
const { publishMqttMessage } = require('./mqtt_service');

// Helper untuk memetakan nama hari dari Bahasa Inggris ke Bahasa Indonesia
const dayMapEnToId = {
  Sun: 'Min',
  Mon: 'Sen',
  Tue: 'Sel',
  Wed: 'Rab',
  Thu: 'Kam',
  Fri: 'Jum',
  Sat: 'Sab',
};

/**
 * Memulai Scheduler Engine yang berjalan setiap menit.
 * @param {Map<string, WebSocket>} clientConnections Map dari userId ke koneksi WebSocket.
 */
const startScheduler = (clientConnections) => {
  console.log('[Scheduler] Engine is running. Checking for tasks every minute.');

  cron.schedule(
    '* * * * *',
    async () => {
      // =================================================================
      // ================== SOLUSI FINAL ZONA WAKTU ==================
      const now = new Date();

      // Dapatkan hari dalam format 'short' (e.g., "Thu") sesuai timezone Jakarta
      const dayFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
      });
      const jakartaDayShort = dayFormatter.format(now); // Hasil: "Thu"
      const currentDay = dayMapEnToId[jakartaDayShort]; // Konversi ke "Kam"

      // Dapatkan waktu dalam format "HH:mm" sesuai timezone Jakarta
      const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const currentTime = timeFormatter.format(now); // Hasil: "01:00"
      // =================================================================

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
              const payload = JSON.stringify({
                deviceId: device.deviceId,
                timestamp: new Date().toISOString(),
                power: targetState ? Math.random() * 50 + 10 : 0,
                voltage: 220,
                current: targetState ? Math.random() * 0.5 : 0,
                energyKWh: 0,
                powerFactor: 0.9,
                status: targetState ? 'ON' : 'OFF',
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
    },
    {
      scheduled: true,
      timezone: 'Asia/Jakarta',
    }
  );
};

module.exports = { startScheduler };
