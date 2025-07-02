// services/mqtt_service.js

const mqtt = require('mqtt');
const PowerLog = require('../models/PowerLog');
const Device = require('../models/Device');

let client = null;

// --- STATE MANAGEMENT UNTUK CLAIMING ---
// Struktur: Map<deviceId, { confirmed: boolean }>
const unclaimedDevices = new Map();
const unclaimedDeviceTimers = new Map();

// --- LOGIKA BATCH PROCESSING UNTUK TELEMETRI ---
const telemetryBuffer = new Map();
const BATCH_INTERVAL_MS = 5 * 60 * 1000;

async function processTelemetryBuffer() {
  if (telemetryBuffer.size === 0) return;
  console.log(`[Batch] Memproses buffer telemetri untuk ${telemetryBuffer.size} perangkat...`);
  const logsToInsert = [];
  for (const [deviceId, messages] of telemetryBuffer.entries()) {
    if (messages.length === 0) continue;
    const avgVoltage = messages.reduce((sum, msg) => sum + (msg.voltage || 0), 0) / messages.length;
    const avgCurrent = messages.reduce((sum, msg) => sum + (msg.current || 0), 0) / messages.length;
    const avgPower = messages.reduce((sum, msg) => sum + (msg.power || 0), 0) / messages.length;
    const avgPowerFactor = messages.reduce((sum, msg) => sum + (msg.powerFactor || 0), 0) / messages.length;
    const lastEnergyKWh = messages.length > 0 ? messages[messages.length - 1].energyKWh : 0;
    logsToInsert.push({
      deviceId, timestamp: new Date(), voltage: avgVoltage, current: avgCurrent,
      power: avgPower, energyKWh: lastEnergyKWh, powerFactor: avgPowerFactor,
    });
  }
  try {
    if (logsToInsert.length > 0) {
      await PowerLog.insertMany(logsToInsert);
      console.log(`[Batch] Berhasil menyimpan ${logsToInsert.length} log agregat.`);
    }
  } catch (error) {
    console.error('[Batch] Gagal menyimpan data batch:', error);
  }
  telemetryBuffer.clear();
}

setInterval(processTelemetryBuffer, BATCH_INTERVAL_MS);

// --- FUNGSI HELPER YANG DIEKSPOR ---
const isDeviceConfirmed = (deviceId) => unclaimedDevices.has(deviceId) && unclaimedDevices.get(deviceId).confirmed === true;
const confirmDeviceClaim = (deviceId) => {
  unclaimedDevices.delete(deviceId);
  if (unclaimedDeviceTimers.has(deviceId)) {
    clearTimeout(unclaimedDeviceTimers.get(deviceId));
    unclaimedDeviceTimers.delete(deviceId);
  }
  console.log(`[Claim] Perangkat ${deviceId} berhasil diklaim.`);
};

// --- FUNGSI KONEKSI UTAMA ---
const connectMqtt = (clientConnections) => {
  let brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) { return console.error("[MQTT] Error: MQTT_BROKER_URL tidak terdefinisi."); }
  if (!/^(mqtt|mqtts|ws|wss):\/\//.test(brokerUrl)) { brokerUrl = `mqtt://${brokerUrl}`; }

  const options = { clientId: `digihome_backend_${Math.random().toString(16).slice(2, 8)}` };
  client = mqtt.connect(brokerUrl, options);

  client.on('connect', () => {
    console.log('[MQTT] Berhasil terhubung ke broker.');
    client.subscribe('digihome/#', { qos: 1 }, (err) => {
      if (!err) console.log('[MQTT] Berlangganan ke topik generik: digihome/#');
    });
  });

  client.on('message', async (topic, payload) => {
    console.log(`[MQTT] Pesan diterima di topik [${topic}]`);
    let message;
    try {
      message = JSON.parse(payload.toString());
    } catch (error) {
      console.error(`[MQTT] Gagal parse JSON dari topik ${topic}:`, payload.toString());
      return;
    }

    // --- PERBAIKAN: Selalu gunakan deviceId dari payload untuk konsistensi ---
    const { deviceId } = message;
    if (!deviceId) {
      console.warn(`[MQTT] Menerima pesan tanpa deviceId di topik ${topic}`);
      return;
    }

    try {
      const topicType = topic.split('/')[1]; // 'provisioning', 'devices'

      if (topicType === 'provisioning') {
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
        } else if (topic.endsWith('/confirm')) {
          if (unclaimedDevices.has(deviceId)) {
            unclaimedDevices.set(deviceId, { confirmed: true });
            console.log(`[Provisioning] Konfirmasi fisik untuk ${deviceId} DITERIMA & STATUS DIPERBARUI.`);
            console.log('[Provisioning] Status daftar tunggu saat ini:', Array.from(unclaimedDevices.entries()));
          }
        }
      } else if (topicType === 'devices') {
        if (topic.endsWith('/status')) {
          await Device.findOneAndUpdate({ deviceId }, { isOnline: message.isOnline }, { new: true });
        } else if (topic.endsWith('/telemetry')) {
          const device = await Device.findOne({ deviceId });
          if (device) {
            // Update status WiFi
            await device.updateOne({ wifiSsid: message.wifiSsid, wifiRssi: message.wifiRssi, isOnline: true });
            // Teruskan ke WebSocket
            if (device.owner) {
              const ownerSocket = clientConnections.get(device.owner.toString());
              if (ownerSocket && ownerSocket.readyState === 1) { 
                  ownerSocket.send(payload.toString());
              }
            }
          }
          // Simpan ke buffer
          if (!telemetryBuffer.has(deviceId)) telemetryBuffer.set(deviceId, []);
          telemetryBuffer.get(deviceId).push(message);
        }
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
