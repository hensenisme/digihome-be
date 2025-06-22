// controllers/deviceController.js

const Device = require('../models/Device');
const asyncHandler = require('../middleware/asyncHandler');

// ======================= PERBAIKAN UTAMA DI SINI =======================
// Impor kembali 'publishMqttMessage' dari mqtt_service
const { 
  isDeviceConfirmed, 
  confirmDeviceClaim,
  unclaimedDevices,
  publishMqttMessage // <-- Impor fungsi yang hilang
} = require('../services/mqtt_service');
// =======================================================================


// FUNGSI BARU: Untuk mengecek status klaim
const getClaimStatus = asyncHandler(async (req, res) => {
  let confirmedDeviceId = null;
  for (const [deviceId, status] of unclaimedDevices.entries()) {
    if (status.confirmed) {
      confirmedDeviceId = deviceId;
      break; 
    }
  }

  if (confirmedDeviceId) {
    res.status(200).json({ status: 'ready', deviceId: confirmedDeviceId });
  } else {
    res.status(202).json({ status: 'waiting' }); 
  }
});

const claimDevice = asyncHandler(async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    res.status(400);
    throw new Error('deviceId diperlukan.');
  }

  const existingDevice = await Device.findOne({ deviceId });
  if (existingDevice) {
    confirmDeviceClaim(deviceId); 
    res.status(400);
    throw new Error('Perangkat ini sudah terdaftar di sistem.');
  }

  if (!isDeviceConfirmed(deviceId)) {
    res.status(404);
    throw new Error('Perangkat belum dikonfirmasi secara fisik. Tekan tombol pada perangkat.');
  }
  
  const newDevice = new Device({
    owner: req.user._id,
    deviceId: deviceId,
    name: `DigiPlug ${deviceId.slice(-6)}`,
    type: 'plug',
  });

  const createdDevice = await newDevice.save();
  confirmDeviceClaim(deviceId);
  res.status(201).json(createdDevice); 
});

const getDevices = asyncHandler(async (req, res) => {
  const devices = await Device.find({ owner: req.user.id });
  res.json(devices);
});

const updateDevice = asyncHandler(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (device && device.owner.toString() === req.user.id.toString()) {
    const wasActive = device.active;
    
    // Perbarui nama, ruangan, atau status 'active' dari body request
    device.name = req.body.name || device.name;
    device.room = req.body.room || device.room;
    if (typeof req.body.active === 'boolean') {
      device.active = req.body.active;
    }

    const updatedDevice = await device.save();

    // ======================= PERBAIKAN UTAMA DI SINI =======================
    // Jika status 'active' (ON/OFF) berubah, kirim perintah MQTT
    // Pastikan kode ini tidak dikomentari lagi
    if (wasActive !== updatedDevice.active) {
      const topic = `digihome/devices/${updatedDevice.deviceId}/command`;
      const message = { action: "SET_STATUS", payload: updatedDevice.active ? "ON" : "OFF" };
      publishMqttMessage(topic, message);
    }
    // =======================================================================
    
    res.json(updatedDevice);
  } else {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan atau Anda tidak berwenang');
  }
});

const deleteDevice = asyncHandler(async (req, res) => {
  const device = await Device.findById(req.params.id);
  if (device && device.owner.toString() === req.user.id.toString()) {
    const topic = `digihome/devices/${device.deviceId}/command`;
    publishMqttMessage(topic, { action: "FACTORY_RESET" });
    await device.deleteOne();
    res.json({ message: 'Perangkat berhasil dihapus dari akun dan direset.' });
  } else {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan atau Anda tidak berwenang');
  }
});

module.exports = {
  getDevices,
  claimDevice,
  updateDevice,
  deleteDevice,
  getClaimStatus,
};
