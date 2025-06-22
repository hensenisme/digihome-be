const PowerLog = require('./models/PowerLog');
const { WebSocket } = require('ws');

// --- Fungsi Baru untuk Mengisi Data Historis ---
const populateInitialData = async () => {
  try {
    const logCount = await PowerLog.countDocuments();
    if (logCount > 0) {
      console.log('Historical data already exists. Skipping population.');
      return;
    }

    console.log('No historical data found. Populating a 60-day history...');
    const now = new Date();
    const logs = [];
    const random = Math.random;

    // Generate data untuk 60 hari terakhir
    for (let i = 60; i >= 0; i--) {
      // Buat beberapa log data per hari untuk membuatnya lebih variatif
      for (let j = 0; j < 8; j++) {
        const timestamp = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000) - (j * 3 * 60 * 60 * 1000));
        
        const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
        
        // Simulasi pemakaian lebih tinggi di malam hari dan akhir pekan
        const hour = timestamp.getHours();
        const usageMultiplier = (hour >= 18 || hour <= 6 || isWeekend) ? 1.5 : 1;

        const voltage = 220 + random() * 10 - 5;
        const current = (1.0 + random()) * usageMultiplier;
        const powerFactor = 0.9 + random() * 0.09;
        const power = voltage * current * powerFactor;
        const energyKWh = (power / 1000) * (j * 3); // Simulasi akumulasi per 3 jam

        const newLog = new PowerLog({
          deviceId: 'digiplug_001',
          timestamp: timestamp,
          voltage: voltage,
          current: current,
          power: power,
          energyKWh: energyKWh,
          powerFactor: powerFactor,
        });
        logs.push(newLog);
      }
    }

    await PowerLog.insertMany(logs);
    console.log(`Successfully populated database with ${logs.length} historical logs.`);
  } catch (error) {
    console.error('Error populating initial data:', error.message);
  }
};


// --- Fungsi yang Sudah Ada, Diperbarui Sedikit ---
const startRealtimeSimulation = (wss) => {
  console.log('Starting Digi-Plug real-time simulation...');

  setInterval(async () => {
    try {
      const random = Math.random;
      const voltage = 220 + random() * 4 - 2; 
      const current = 1.2 + random() * 0.4 - 0.2;
      const powerFactor = 0.95 + random() * 0.04 - 0.02;
      const power = voltage * current * powerFactor;

      const lastLog = await PowerLog.findOne({ deviceId: 'digiplug_001' }).sort({ timestamp: -1 });
      const lastEnergy = lastLog ? lastLog.energyKWh : 0;
      const newEnergy = lastEnergy + (power / 1000) * (3 / 3600); 

      const newLogData = new PowerLog({
        deviceId: 'digiplug_001',
        timestamp: new Date(),
        voltage: voltage,
        current: current,
        power: power,
        energyKWh: newEnergy,
        powerFactor: powerFactor,
      });

      const createdLog = await newLogData.save();
      console.log('New real-time log saved:', createdLog.power.toFixed(2), 'W');

      const payload = JSON.stringify(createdLog);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });

    } catch (error) {
      console.error('Real-time simulation error:', error.message);
    }
  }, 3000); 
};

module.exports = { populateInitialData, startRealtimeSimulation };
