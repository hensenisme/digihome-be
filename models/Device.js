// models/Device.js

const mongoose = require('mongoose');
// Hapus dependensi ke mqtt_service untuk memutus siklus
// const { publishMqttMessage } = require('../services/mqtt_service'); 

const deviceSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    deviceId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    room: { type: String, default: 'Unassigned' },
    active: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    indexes: [{ fields: { owner: 1, deviceId: 1 }, unique: true }],
  }
);

// --- PERBAIKAN: Hapus hook 'pre' atau 'post' dari sini ---
// Logika pengiriman MQTT akan dipindahkan ke controller.
// Ini membuat model lebih bersih dan fokus pada struktur data saja.

const Device = mongoose.model('Device', deviceSchema);
module.exports = Device;
