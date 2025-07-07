// services/scheduler_service.js
const cron = require('node-cron');
const Schedule = require('../models/Schedule');
const Device = require('../models/Device');
const User = require('../models/User'); // Ditambahkan untuk budget
const PowerLog = require('../models/PowerLog'); // Ditambahkan untuk budget
const { WebSocket } = require('ws');
const { publishMqttMessage } = require('./mqtt_service');
const { sendNotificationToUser } = require('./notification_service'); // Ditambahkan untuk budget

// Helper untuk memetakan nama hari (dari kode asli Anda)
const dayMapEnToId = {
  Sun: 'Min', Mon: 'Sen', Tue: 'Sel',
  Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab',
};

// Definisikan tarif listrik di backend agar konsisten
const TARIFF_RATES = {
  tier900: 1352.0,
  tier1300: 1444.7,
  tier2200: 1444.7,
  other: 1699.5,
};

// ================== FUNGSI BARU UNTUK PENGECEKAN BUDGET ==================
async function checkUserBudgets() {
  console.log('[Budget] Memulai pengecekan budget pengguna...');
  const now = new Date();
  // Menggunakan waktu Jakarta untuk konsistensi
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const currentMonth = jakartaTime.getMonth() + 1;
  const currentYear = jakartaTime.getFullYear();

  const users = await User.find({});

  for (const user of users) {
    if (user.settings.budgetNotificationSent?.month === currentMonth && user.settings.budgetNotificationSent?.year === currentYear) {
      continue;
    }

    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const userDevices = await Device.find({ owner: user._id }).select('deviceId');
    const userDeviceIds = userDevices.map(d => d.deviceId);

    let totalKwhThisMonth = 0;
    for (const deviceId of userDeviceIds) {
      const firstLog = await PowerLog.findOne({ deviceId, timestamp: { $gte: startOfMonth } }).sort({ timestamp: 1 });
      const lastLog = await PowerLog.findOne({ deviceId, timestamp: { $lte: endOfMonth } }).sort({ timestamp: -1 });

      if (firstLog && lastLog && lastLog.energyKWh > firstLog.energyKWh) {
        totalKwhThisMonth += (lastLog.energyKWh - firstLog.energyKWh);
      }
    }

    const userTariff = TARIFF_RATES[user.settings.tariffTier] || TARIFF_RATES['tier1300'];
    const estimatedCost = totalKwhThisMonth * userTariff;
    const budget = user.settings.monthlyBudget;
    
    if (budget > 0) {
        const usagePercentage = (estimatedCost / budget) * 100;

        if (usagePercentage > 80) {
          const title = 'Peringatan Anggaran Listrik';
          const body = `Pemakaian bulan ini telah mencapai ${usagePercentage.toFixed(0)}% (Rp ${Math.round(estimatedCost).toLocaleString('id-ID')}) dari anggaran Anda.`;
          
          await sendNotificationToUser(user._id, title, body);

          user.settings.budgetNotificationSent = { month: currentMonth, year: currentYear };
          await user.save();
        }
    }
  }
  console.log('[Budget] Pengecekan budget selesai.');
}
// ==========================================================================

const startScheduler = (clientConnections) => {
  console.log('[Scheduler] Engine is running.');

  // ================== JADWAL PERANGKAT (DARI KODE ASLI ANDA) ==================
  // Tugas ini tetap berjalan setiap menit untuk mengeksekusi jadwal ON/OFF perangkat.
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' });
    const jakartaDayShort = dayFormatter.format(now);
    const currentDay = dayMapEnToId[jakartaDayShort];
    const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
    const currentTime = timeFormatter.format(now);

    // ... (SELURUH BLOK LOGIKA 'try-catch' UNTUK JADWAL PERANGKAT DARI KODE ASLI ANDA TETAP DI SINI) ...
    try {
        const dueSchedules = await Schedule.find({
          isEnabled: true,
          days: currentDay,
          $or: [{ startTime: currentTime }, { endTime: currentTime }],
        });

        if (dueSchedules.length === 0) return;

        console.log(`[Scheduler] Found ${dueSchedules.length} due tasks.`);

        for (const schedule of dueSchedules) {
          let targetState;
          if (schedule.startTime === currentTime) {
            targetState = schedule.action === 'ON';
          } else {
            targetState = !(schedule.action === 'ON');
          }

          const device = await Device.findOne({ deviceId: schedule.deviceId, owner: schedule.owner });
          if (!device) {
            console.log(`[Scheduler] Device ${schedule.deviceId} not found for schedule ${schedule._id}`);
            continue;
          }

          if (device.active !== targetState) {
            device.active = targetState;
            await device.save();
            console.log(`[Scheduler] Executed DB update: Set device ${device.name} to ${targetState ? 'ON' : 'OFF'}`);

            const topic = `digihome/devices/${device.deviceId}/command`;
            const message = { action: 'SET_STATUS', payload: targetState ? 'ON' : 'OFF' };
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
              console.log(`[Scheduler] Notified user ${device.owner} about status change.`);
            }
          }
        }
    } catch (error) {
    console.error('[Scheduler] Error during task execution:', error);
    }
  }, { scheduled: true, timezone: 'Asia/Jakarta' });
  // =================================================================================

  // ================== JADWAL BARU UNTUK BUDGET ==================
  // Jadwalkan pengecekan budget untuk berjalan sekali setiap hari pukul 08:00 pagi.
  cron.schedule('0 8 * * *', checkUserBudgets, {
    scheduled: true,
    timezone: 'Asia/Jakarta',
  });
  // ===============================================================
};

module.exports = { startScheduler };
