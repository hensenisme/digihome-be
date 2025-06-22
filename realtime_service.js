const PowerLog = require('./models/PowerLog');
const Device = require('./models/Device'); // <-- Impor model Device
const { WebSocket } = require('ws');

/**
 * Memulai simulasi yang menghasilkan data baru setiap 3 detik
 * dan hanya untuk perangkat yang statusnya aktif.
 * @param {WebSocketServer} wss Instance WebSocket Server untuk menyiarkan data.
 */
const startRealtimeSimulation = (wss) => {
  console.log('[Simulation] Memulai simulasi real-time...');

  const deviceIds = ['digiplug001', 'lampu'];
  let currentDeviceIndex = 0;

  setInterval(async () => {
    try {
      const deviceId = deviceIds[currentDeviceIndex];

      // --- VALIDASI ON/OFF ---
      // 1. Cek status perangkat di database
      const device = await Device.findOne({ deviceId: deviceId });

      // 2. Jika perangkat tidak ada atau statusnya 'active: false', lewati iterasi ini
      if (!device || !device.active) {
        console.log(`[Simulation] Perangkat ${deviceId} sedang OFF. Melewatkan pengiriman data.`);
        // Pindah ke perangkat berikutnya
        currentDeviceIndex = (currentDeviceIndex + 1) % deviceIds.length;
        return; 
      }
      
      console.log(`[Simulation] Perangkat ${deviceId} sedang ON. Menghasilkan data...`);
      // --- Lanjutan Logika Simulasi ---

      const random = Math.random;
      const voltage = 220 + random() * 4 - 2; 
      const powerFactor = 0.95 + random() * 0.04 - 0.02;

      let current, power;
      if (deviceId === 'digiplug_kulkas_01') {
        current = 1.0 + random() * 0.5;
        power = voltage * current * powerFactor;
      } else {
        current = 0.1 + random() * 0.1;
        power = voltage * current * powerFactor;
      }

      const lastLog = await PowerLog.findOne({ deviceId: deviceId }).sort({ timestamp: -1 });
      const lastEnergy = lastLog ? lastLog.energyKWh : 0;
      const newEnergy = lastEnergy + (power / 1000) * (3 / 3600); 

      const newLogData = new PowerLog({
        deviceId: deviceId,
        timestamp: new Date(),
        voltage, current, power, energyKWh: newEnergy, powerFactor,
      });

      const createdLog = await newLogData.save();
      const payload = JSON.stringify(createdLog);

      // Siarkan ke semua klien
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
      console.log(`[WebSocket] Berhasil mengirim data untuk ${deviceId}: ${power.toFixed(2)} W`);

      // Pindah ke perangkat berikutnya
      currentDeviceIndex = (currentDeviceIndex + 1) % deviceIds.length;

    } catch (error) {
      console.error('[Simulation] Error:', error.message);
    }
  }, 3000); 
};

module.exports = { startRealtimeSimulation };
