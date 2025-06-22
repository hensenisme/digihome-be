// services/mqtt_service.js

const mqtt = require('mqtt');
const PowerLog = require('../models/PowerLog');
const Device = require('../models/Device');

let client = null;

// ================== LOGIKA CLAIMING & BATCHING ==================
// Map untuk menyimpan state perangkat yang belum diklaim: { confirmed: boolean }
const unclaimedDevices = new Map();
const unclaimedDeviceTimers = new Map();

// Buffer untuk menampung data telemetri sebelum disimpan ke DB
const telemetryBuffer = new Map();
const BATCH_INTERVAL_MS = 5 * 60 * 1000; // Interval 5 menit

/**
 * Memproses buffer dan menyimpan data rata-rata ke database.
 */
async function processTelemetryBuffer() {
  if (telemetryBuffer.size === 0) {
    return;
  }

  console.log(`[Batch] Memproses buffer telemetri untuk ${telemetryBuffer.size} perangkat...`);
  const logsToInsert = [];

  for (const [deviceId, messages] of telemetryBuffer.entries()) {
    if (messages.length === 0) continue;

    // Hitung rata-rata untuk setiap field
    const avgVoltage = messages.reduce((sum, msg) => sum + (msg.voltage || 0), 0) / messages.length;
    const avgCurrent = messages.reduce((sum, msg) => sum + (msg.current || 0), 0) / messages.length;
    const avgPower = messages.reduce((sum, msg) => sum + (msg.power || 0), 0) / messages.length;
    const avgPowerFactor = messages.reduce((sum, msg) => sum + (msg.powerFactor || 0), 0) / messages.length;
    
    // Untuk energi, kita ambil nilai terakhir karena sifatnya akumulatif
    const lastEnergyKWh = messages[messages.length - 1].energyKWh;

    logsToInsert.push({
      deviceId: deviceId,
      timestamp: new Date(), // Gunakan waktu saat batch diproses
      voltage: avgVoltage,
      current: avgCurrent,
      power: avgPower,
      energyKWh: lastEnergyKWh,
      powerFactor: avgPowerFactor,
    });
  }

  try {
    if (logsToInsert.length > 0) {
      await PowerLog.insertMany(logsToInsert);
      console.log(`[Batch] Berhasil menyimpan ${logsToInsert.length} log agregat ke database.`);
    }
  } catch (error) {
    console.error('[Batch] Gagal menyimpan data batch ke database:', error);
  }

  // Kosongkan buffer setelah diproses
  telemetryBuffer.clear();
}

// Menjalankan proses batch secara periodik
setInterval(processTelemetryBuffer, BATCH_INTERVAL_MS);


// Fungsi-fungsi helper untuk diakses oleh controller
const isDeviceConfirmed = (deviceId) => {
  return unclaimedDevices.has(deviceId) && unclaimedDevices.get(deviceId).confirmed === true;
};

const confirmDeviceClaim = (deviceId) => {
  unclaimedDevices.delete(deviceId);
  if (unclaimedDeviceTimers.has(deviceId)) {
    clearTimeout(unclaimedDeviceTimers.get(deviceId));
    unclaimedDeviceTimers.delete(deviceId);
  }
  console.log(`[Claim] Perangkat ${deviceId} berhasil diklaim.`);
};

const connectMqtt = (clientConnections) => {
  let brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.error("[MQTT] Error: MQTT_BROKER_URL tidak terdefinisi.");
    return;
  }
  if (!/^(mqtt|mqtts|ws|wss):\/\//.test(brokerUrl)) {
    brokerUrl = `mqtt://${brokerUrl}`;
  }

  const options = {
    clientId: `digihome_backend_${Math.random().toString(16).slice(2, 8)}`,
  };

  client = mqtt.connect(brokerUrl, options);

  client.on('connect', () => {
    console.log('[MQTT] Berhasil terhubung ke broker.');
    client.subscribe('digihome/#', { qos: 1 }, (err) => {
      if (!err) console.log('[MQTT] Berlangganan ke topik digihome/#');
    });
  });

  client.on('message', async (topic, payload) => {
    let message;
    try {
      message = JSON.parse(payload.toString());
    } catch (error) {
        console.error(`[MQTT] Gagal parse JSON dari topik ${topic}:`, payload.toString());
        return;
    }
    
    const { deviceId } = message;
    if (!deviceId) return;

    try {
      if (topic.endsWith('/online')) {
        console.log(`[Provisioning] Perangkat ${deviceId} online, menunggu konfirmasi fisik.`);
        unclaimedDevices.set(deviceId, { confirmed: false });
        const timer = setTimeout(() => {
            if (unclaimedDevices.has(deviceId)) {
                unclaimedDevices.delete(deviceId);
                unclaimedDeviceTimers.delete(deviceId);
                console.log(`[Provisioning] Batas waktu klaim untuk ${deviceId} habis.`);
            }
        }, 5 * 60 * 1000);
        unclaimedDeviceTimers.set(deviceId, timer);
      } 
      else if (topic.endsWith('/confirm')) {
        if (unclaimedDevices.has(deviceId)) {
          console.log(`[Provisioning] Konfirmasi fisik untuk ${deviceId} diterima.`);
          unclaimedDevices.set(deviceId, { confirmed: true });
        }
      } 
      else if (topic.includes('/telemetry')) {
        // 1. Teruskan data ke aplikasi secara REAL-TIME via WebSocket
        const device = await Device.findOne({ deviceId: deviceId });
        if (device && device.owner) {
            const ownerSocket = clientConnections.get(device.owner.toString());
            if (ownerSocket && ownerSocket.readyState === 1) { 
                ownerSocket.send(payload.toString());
            }
        }
        // 2. Simpan data ke BUFFER untuk diproses nanti
        if (!telemetryBuffer.has(deviceId)) {
            telemetryBuffer.set(deviceId, []);
        }
        telemetryBuffer.get(deviceId).push(message);
      }
    } catch (error) {
      console.error(`[MQTT] Gagal memproses pesan dari topik ${topic}:`, error.message);
    }
  });

  client.on('error', (error) => console.error('[MQTT] Error koneksi:', error));
};

const publishMqttMessage = (topic, message) => {
    if (client && client.connected) {
        const payload = JSON.stringify(message);
        client.publish(topic, payload);
    } else {
        console.error('[MQTT] Tidak bisa publish. Klien tidak terhubung.');
    }
};

module.exports = { connectMqtt, publishMqttMessage, isDeviceConfirmed, confirmDeviceClaim, unclaimedDevices };
