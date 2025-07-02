// controllers/deviceController.js

const Device = require('../models/Device');
const asyncHandler = require('../middleware/asyncHandler');

// Impor fungsi-fungsi yang dibutuhkan dari service MQTT
const {
  isDeviceConfirmed,
  confirmDeviceClaim,
  unclaimedDevices,
  publishMqttMessage,
} = require('../services/mqtt_service');

// @desc    Get claim status for a new device
// @route   GET /api/devices/claim-status
// @access  Private
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

// @desc    Claim a new device for a user
// @route   POST /api/devices/claim
// @access  Private
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
    throw new Error(
      'Perangkat belum dikonfirmasi secara fisik. Tekan tombol pada perangkat.'
    );
  }

  const newDevice = new Device({
    owner: req.user.id,
    deviceId: deviceId,
    name: `DigiPlug ${deviceId.slice(-6)}`,
    type: 'plug',
  });

  const createdDevice = await newDevice.save();
  confirmDeviceClaim(deviceId);
  res.status(201).json(createdDevice);
});

// @desc    Get all devices for a logged-in user
// @route   GET /api/devices
// @access  Private
const getDevices = asyncHandler(async (req, res) => {
  const devices = await Device.find({ owner: req.user.id });
  res.json(devices);
});

// @desc    Update a device's properties (name, room, favorite, active)
// @route   PUT /api/devices/:id
// @access  Private
const updateDevice = asyncHandler(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (device && device.owner.toString() === req.user.id.toString()) {
    const wasActive = device.active;

    // Perbarui nama dan ruangan jika ada di body request
    device.name = req.body.name || device.name;
    device.room = req.body.room || device.room;

    // =================================================================
    // ================== SOLUSI MASALAH FAVORIT ADA DI SINI ==================
    // Tambahkan blok ini untuk menangani pembaruan field 'isFavorite'.
    // Kode ini akan memeriksa apakah ada data 'isFavorite' di dalam request,
    // dan jika ada, akan memperbarui nilainya di database.
    if (typeof req.body.isFavorite === 'boolean') {
      device.isFavorite = req.body.isFavorite;
    }
    // =================================================================
    // =================================================================

    // Perbarui status aktif (ON/OFF)
    if (typeof req.body.active === 'boolean') {
      device.active = req.body.active;
    }

    const updatedDevice = await device.save();

    // Jika status 'active' berubah, kirim perintah MQTT ke perangkat
    if (wasActive !== updatedDevice.active) {
      const topic = `digihome/devices/${updatedDevice.deviceId}/command`;
      const message = {
        action: 'SET_STATUS',
        payload: updatedDevice.active ? 'ON' : 'OFF',
      };
      publishMqttMessage(topic, message);
    }

    res.json(updatedDevice);
  } else {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan atau Anda tidak berwenang');
  }
});

// @desc    Delete a device
// @route   DELETE /api/devices/:id
// @access  Private
const deleteDevice = asyncHandler(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (device && device.owner.toString() === req.user.id.toString()) {
    const topic = `digihome/devices/${device.deviceId}/command`;
    publishMqttMessage(topic, { action: 'FACTORY_RESET' });
    await device.deleteOne();
    res.json({ message: 'Perangkat berhasil dihapus dari akun dan direset.' });
  } else {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan atau Anda tidak berwenang');
  }
});

// @desc    Update a device's specific configuration
// @route   PUT /api/devices/:id/config
// @access  Private
const setDeviceConfig = asyncHandler(async (req, res) => {
  const { configKey, value } = req.body;
  const device = await Device.findById(req.params.id);

  if (device && device.owner.toString() === req.user.id.toString()) {
    if (
      configKey === 'overcurrentThreshold' &&
      typeof value === 'number' &&
      value > 0
    ) {
      device.config.overcurrentThreshold = value;
      await device.save();

      const topic = `digihome/devices/${device.deviceId}/command`;
      const message = {
        action: 'SET_CONFIG',
        payload: { [configKey]: value },
      };
      publishMqttMessage(topic, message);

      res
        .status(200)
        .json({ message: `Konfigurasi ${configKey} berhasil diperbarui.` });
    } else {
      res
        .status(400)
        .send({ message: 'Kunci konfigurasi atau nilai tidak valid.' });
    }
  } else {
    res
      .status(404)
      .send({ message: 'Perangkat tidak ditemukan atau Anda tidak berwenang.' });
  }
});

// @desc    Command a device to enter re-provisioning mode
// @route   POST /api/devices/:id/re-provision
// @access  Private
const enterReProvisioningMode = asyncHandler(async (req, res) => {
  const device = await Device.findById(req.params.id);

  if (device && device.owner.toString() === req.user.id.toString()) {
    const topic = `digihome/devices/${device.deviceId}/command`;
    const message = { action: 'ENTER_PROVISIONING' };
    publishMqttMessage(topic, message);
    res.status(200).json({ message: 'Perintah re-provisioning terkirim.' });
  } else {
    res
      .status(404)
      .send({ message: 'Perangkat tidak ditemukan atau Anda tidak berwenang.' });
  }
});

module.exports = {
  getDevices,
  claimDevice,
  updateDevice,
  deleteDevice,
  getClaimStatus,
  setDeviceConfig,
  enterReProvisioningMode,
};
