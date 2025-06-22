// services/realtime_service.js

const PowerLog = require('../models/PowerLog');
const Device = require('../models/Device');
const { WebSocket } = require('ws');

/**
 * Memulai simulasi yang menghasilkan data baru setiap 3 detik
 * untuk SEMUA perangkat yang statusnya 'active: true' di database.
 * @param {Map<string, WebSocket>} clientConnections - Map dari userId ke koneksi WebSocket.
 */
const startRealtimeSimulation = (clientConnections) => {
  console.log('[Simulation] Memulai simulasi real-time berbasis database...');

  setInterval(async () => {
    try {
      // 1. Ambil semua perangkat yang sedang aktif dari database
      const activeDevices = await Device.find({ active: true });

      if (activeDevices.length === 0) {
        // console.log('[Simulation] Tidak ada perangkat aktif saat ini.');
        return;
      }
      
      console.log(`[Simulation] Found ${activeDevices.length} active device(s). Generating data...`);

      // 2. Loop melalui setiap perangkat aktif dan hasilkan data
      for (const device of activeDevices) {
        const logData = generateLogForDevice(device);
        const lastLog = await PowerLog.findOne({ deviceId: device.deviceId }).sort({ timestamp: -1 });
        const lastEnergy = lastLog ? lastLog.energyKWh : 0;
        
        // Interval adalah 3 detik
        const newEnergy = lastEnergy + (logData.power / 1000) * (3 / 3600);

        const newLog = new PowerLog({
          deviceId: device.deviceId,
          timestamp: new Date(),
          voltage: logData.voltage,
          current: logData.current,
          power: logData.power,
          energyKWh: newEnergy,
          powerFactor: logData.powerFactor,
        });

        const createdLog = await newLog.save();
        const payload = JSON.stringify(createdLog);

        // --- PEMBARUAN UTAMA: PENGIRIMAN BERTARGET ---
        const ownerId = device.owner.toString();
        const userSocket = clientConnections.get(ownerId);

        if (userSocket && userSocket.readyState === WebSocket.OPEN) {
          userSocket.send(payload);
          console.log(`[WebSocket] Sent data for ${device.deviceId} to user ${ownerId}`);
        }
      }
    } catch (error) {
      console.error('[Simulation] Error:', error.message);
    }
  }, 3000); // Berjalan setiap 3 detik
};

/**
 * Helper function untuk menghasilkan data log palsu berdasarkan tipe perangkat.
 * @param {object} device - Objek perangkat dari Mongoose.
 * @returns {object} - Objek berisi data telemetri yang disimulasikan.
 */
function generateLogForDevice(device) {
  const random = Math.random;
  const voltage = 220 + random() * 10 - 5; // 215V - 225V

  let baseCurrent = 0.5, currentVar = 0.2, powerFactor = 0.9;

  // Berikan karakteristik berbeda untuk setiap tipe perangkat
  switch (device.type) {
    case 'AC':
      baseCurrent = 2.0; currentVar = 1.0; powerFactor = 0.85;
      break;
    case 'Kulkas':
      // Kulkas memiliki siklus on/off, kita simulasikan secara sederhana
      baseCurrent = (new Date().getMinutes() % 10 < 5) ? 0.8 : 0.1;
      currentVar = 0.3;
      break;
    case 'Smart TV':
      baseCurrent = 0.7; currentVar = 0.4;
      break;
    case 'Lampu':
      baseCurrent = 0.05; currentVar = 0.01;
      break;
    default: // Untuk DigiPlug dan lainnya
      baseCurrent = 0.5; currentVar = 1.0; // Beri variasi lebih besar
  }

  const current = baseCurrent + random() * currentVar;
  const finalPowerFactor = powerFactor + random() * 0.09;
  const power = voltage * current * finalPowerFactor;

  return { voltage, current, power, powerFactor: finalPowerFactor };
}

module.exports = { startRealtimeSimulation };
