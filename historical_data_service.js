const PowerLog = require('./models/PowerLog');

/**
 * Mengisi database dengan data historis selama 60 hari terakhir untuk beberapa perangkat.
 * Masing-masing perangkat punya karakteristik berbeda agar grafik lebih bermakna.
 */
const populate60DaysData = async () => {
  try {
    const logCount = await PowerLog.countDocuments();
    if (logCount > 0) {
      console.log('Historical data already exists. Skipping population.');
      return;
    }

    console.log('Populating database with 60 days of historical data for multiple devices...');
    const now = new Date();
    const deviceIds = ['digiplug001', 'dp_lamputeras', 'tv', 'dpkamar', 'ac'];
    const logs = [];

    for (const deviceId of deviceIds) {
      let accumulatedEnergy = 0;

      // Beri karakteristik berbeda tiap device
      const deviceProfile = {
        digiplug001: { baseCurrent: 1.2, currentVar: 0.8 },
        dp_lamputeras: { baseCurrent: 0.4, currentVar: 0.3 },
        tv: { baseCurrent: 0.8, currentVar: 0.5 },
        dpkamar: { baseCurrent: 0.6, currentVar: 0.4 },
        ac: { baseCurrent: 2.0, currentVar: 1.0 },
      }[deviceId];

      for (let day = 60; day >= 0; day--) {
        // Variasikan jumlah titik per hari
        const pointsPerDay = (day <= 2) ? 8 : (day <= 7 ? 4 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2));

        for (let point = 0; point < pointsPerDay; point++) {
          // Timestamp yang sedikit diacak agar tidak terlalu seragam
          const hourOffset = (24 / pointsPerDay) * point + Math.random() * 2;
          const timestamp = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) - (hourOffset * 60 * 60 * 1000));

          const isWeekend = timestamp.getUTCDay() === 0 || timestamp.getUTCDay() === 6;
          const hour = timestamp.getUTCHours();

          const usageMultiplier = (hour >= 18 || hour <= 5 || isWeekend) ? 1.5 : 0.8;

          const voltage = 220 + Math.random() * 10 - 5; // 215 - 225 V
          const current = (deviceProfile.baseCurrent + Math.random() * deviceProfile.currentVar) * usageMultiplier;
          const powerFactor = 0.9 + Math.random() * 0.09;
          const power = voltage * current * powerFactor;

          accumulatedEnergy += (power / 1000);

          logs.push({
            deviceId,
            timestamp,
            voltage,
            current,
            power,
            energyKWh: accumulatedEnergy,
            powerFactor,
          });
        }
      }

      console.log(`Generated data for device: ${deviceId}`);
    }

    await PowerLog.insertMany(logs);
    console.log(`Successfully populated database with ${logs.length} historical logs for ${deviceIds.length} devices.`);
  } catch (error) {
    console.error('Error populating initial data:', error.message);
  }
};

module.exports = { populate60DaysData };
