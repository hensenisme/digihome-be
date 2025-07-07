// services/mqtt_service.js

const mqtt = require('mqtt');
const PowerLog = require('../models/PowerLog');
const Device = require('../models/Device');
const { sendNotificationToUser } = require('./notification_service');

let client = null;

// Peta untuk mengelola perangkat yang sedang dalam proses provisioning
const unclaimedDevices = new Map();
const unclaimedDeviceTimers = new Map();

// Buffer untuk mengumpulkan data telemetri sebelum disimpan ke DB secara massal
const telemetryBuffer = new Map();
const BATCH_INTERVAL_MS = 5 * 60 * 1000; // Proses buffer setiap 5 menit

/**
 * Memproses buffer telemetri secara periodik.
 * Mengagregasi data telemetri yang terkumpul untuk setiap perangkat
 * dan menyimpannya sebagai satu entri log untuk efisiensi database.
 */
async function processTelemetryBuffer() {
  if (telemetryBuffer.size === 0) {
    return;
  }
  console.log(`[Batch] Memproses buffer telemetri untuk ${telemetryBuffer.size} perangkat...`);
  
  const logsToInsert = [];
  for (const [deviceId, messages] of telemetryBuffer.entries()) {
    if (messages.length === 0) continue;

    // Hitung rata-rata dari semua metrik yang terkumpul
    const avgVoltage = messages.reduce((sum, msg) => sum + (msg.voltage || 0), 0) / messages.length;
    const avgCurrent = messages.reduce((sum, msg) => sum + (msg.current || 0), 0) / messages.length;
    const avgPower = messages.reduce((sum, msg) => sum + (msg.power || 0), 0) / messages.length;
    const avgPowerFactor = messages.reduce((sum, msg) => sum + (msg.powerFactor || 0), 0) / messages.length;
    // Ambil nilai energi terakhir sebagai nilai akumulasi saat ini
    const lastEnergyKWh = messages.length > 0 ? messages[messages.length - 1].energyKWh : 0;

    logsToInsert.push({
      deviceId,
      timestamp: new Date(),
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
      console.log(`[Batch] Berhasil menyimpan ${logsToInsert.length} log agregat.`);
    }
  } catch (error) {
    console.error('[Batch] Gagal menyimpan data batch:', error);
  }
  
  // Kosongkan buffer setelah diproses
  telemetryBuffer.clear();
}

// Jalankan pemroses buffer secara periodik
setInterval(processTelemetryBuffer, BATCH_INTERVAL_MS);


// Fungsi helper untuk proses klaim perangkat
const isDeviceConfirmed = (deviceId) => unclaimedDevices.has(deviceId) && unclaimedDevices.get(deviceId).confirmed === true;

const confirmDeviceClaim = (deviceId) => {
  unclaimedDevices.delete(deviceId);
  if (unclaimedDeviceTimers.has(deviceId)) {
    clearTimeout(unclaimedDeviceTimers.get(deviceId));
    unclaimedDeviceTimers.delete(deviceId);
  }
  console.log(`[Claim] Perangkat ${deviceId} berhasil diklaim dan dihapus dari daftar tunggu.`);
};

/**
 * Fungsi utama untuk menghubungkan ke broker MQTT dan mengatur semua listener.
 * @param {Map} clientConnections - Peta koneksi WebSocket dari server utama.
 */
const connectMqtt = (clientConnections) => {
  let brokerUrl = process.env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    return console.error('[MQTT] Error: MQTT_BROKER_URL tidak terdefinisi.');
  }
  if (!/^(mqtt|mqtts|ws|wss):\/\//.test(brokerUrl)) {
    brokerUrl = `mqtt://${brokerUrl}`;
  }

  const options = {
    clientId: `digihome_backend_${Math.random().toString(16).slice(2, 8)}`,
    username: process.env.MQTT_USER,
    password: process.env.MQTT_PASSWORD,
  };
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

    try {
      const topicParts = topic.split('/');
      if (topicParts.length < 3) return;

      const topicType = topicParts[1];
      const deviceIdFromTopic = topicParts[2];

      if (topicType === 'devices' && topic.endsWith('/status')) {
        const isOnline = message.online === true;
        const device = await Device.findOne({ deviceId: deviceIdFromTopic });

        if (device && device.isOnline !== isOnline) {
          device.isOnline = isOnline;
          await device.save();
          console.log(`[MQTT-Status] Status perangkat ${device.name} diperbarui menjadi: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

          if (!isOnline) {
            await sendNotificationToUser(
              device.owner,
              `Perangkat Offline`,
              `${device.name} tidak terhubung ke jaringan. Mohon periksa koneksi listrik dan Wi-Fi.`,
              { 'screen': 'digiPlugDetailRoute', 'deviceId': device._id.toString() }
            );
          }
        }
      } else if (topicType === 'devices' && topic.endsWith('/telemetry')) {
        const device = await Device.findOne({ deviceId: deviceIdFromTopic });
        if (!device) return;
        
        await device.updateOne({ isOnline: true, lastSeen: new Date() });

        if (device.owner) {
            const ownerSocket = clientConnections.get(device.owner.toString());
            if (ownerSocket && ownerSocket.readyState === 1) {
                ownerSocket.send(payload.toString());
            }
        }

        if (!telemetryBuffer.has(deviceIdFromTopic)) telemetryBuffer.set(deviceIdFromTopic, []);
        telemetryBuffer.get(deviceIdFromTopic).push(message);

      } else if (topicType === 'devices' && topic.endsWith('/alert')) {
        const device = await Device.findOne({ deviceId: deviceIdFromTopic });
        if (!device) return;
        
        let alertTitle = 'Peringatan Keamanan';
        let alertBody = `Terdeteksi masalah pada perangkat ${device.name}.`;

        if (message.error === 'OVERCURRENT_DETECTED') {
          alertTitle = `Arus Berlebih pada ${device.name}!`;
          alertBody = `Perangkat telah dimatikan secara otomatis untuk keamanan. Arus terdeteksi: ${message.value} A.`;
          
          device.active = false;
          await device.save();
          console.log(`[ALERT] Status perangkat ${device.name} diubah menjadi OFF di database.`);

          const commandTopic = `digihome/devices/${device.deviceId}/command`;
          const commandMessage = { action: 'SET_STATUS', payload: 'OFF' };
          publishMqttMessage(commandTopic, commandMessage);
          console.log(`[ALERT] Perintah OFF dikirim ke topik ${commandTopic}.`);
        }
        
        await sendNotificationToUser(device.owner, alertTitle, alertBody);

      } else if (topicType === 'provisioning') {
        const deviceIdFromMessage = message.deviceId;
        if (!deviceIdFromMessage) return;

        if (topic.endsWith('/online')) {
            console.log(`[Provisioning] Perangkat ${deviceIdFromMessage} online, menunggu konfirmasi fisik.`);
            unclaimedDevices.set(deviceIdFromMessage, { confirmed: false });
            const timer = setTimeout(() => {
                if (unclaimedDevices.has(deviceIdFromMessage)) {
                    unclaimedDevices.delete(deviceIdFromMessage);
                    unclaimedDeviceTimers.delete(deviceIdFromMessage);
                    console.log(`[Provisioning] Batas waktu klaim untuk ${deviceIdFromMessage} habis.`);
                }
            }, 5 * 60 * 1000); // Timeout 5 menit
            unclaimedDeviceTimers.set(deviceIdFromMessage, timer);
        } else if (topic.endsWith('/confirm')) {
            if (unclaimedDevices.has(deviceIdFromMessage)) {
                unclaimedDevices.set(deviceIdFromMessage, { confirmed: true });
                console.log(`[Provisioning] Konfirmasi fisik untuk ${deviceIdFromMessage} DITERIMA.`);
            }
        }
      }
    } catch (error) {
      console.error(`[MQTT] Gagal memproses pesan dari topik ${topic}:`, error.message);
    }
  });

  client.on('error', (error) => console.error('[MQTT] Error koneksi:', error));
};

/**
 * Mempublikasikan pesan ke topik MQTT tertentu.
 * @param {string} topic - Topik tujuan.
 * @param {object} message - Objek pesan yang akan dikirim (akan di-stringify).
 */
const publishMqttMessage = (topic, message) => {
  if (client && client.connected) {
      const payload = JSON.stringify(message);
      client.publish(topic, payload);
  } else {
      console.error('[MQTT] Tidak bisa publish. Klien tidak terhubung.');
  }
};

module.exports = {
  connectMqtt,
  publishMqttMessage,
  isDeviceConfirmed,
  confirmDeviceClaim,
  unclaimedDevices,
};
