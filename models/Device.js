const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    deviceId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    room: { type: String, default: 'Unassigned' },
    active: { type: Boolean, default: false },
    isFavorite: { type: Boolean, default: false },
    attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // --- PENAMBAHAN BARU ---
    isOnline: { type: Boolean, default: false },
    wifiSsid: { type: String, default: 'N/A' },
    wifiRssi: { type: Number, default: 0 },
    config: {
      overcurrentThreshold: { type: Number, default: 5.0 }
    }
    // ----------------------
  },
  {
    timestamps: true,
  }
);

// Hapus index lama jika ada, dan pastikan deviceId unik
// deviceSchema.index({ owner: 1, deviceId: 1 }, { unique: true }); // Ini bagus, tapi deviceId sendiri harus unik di seluruh sistem

const Device = mongoose.model('Device', deviceSchema);
module.exports = Device;