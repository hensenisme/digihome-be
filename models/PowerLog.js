const mongoose = require('mongoose');

const powerLogSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  voltage: { type: Number, required: true },
  current: { type: Number, required: true },
  power: { type: Number, required: true },
  energyKWh: { type: Number, required: true },
  powerFactor: { type: Number, required: true },
});

const PowerLog = mongoose.model('PowerLog', powerLogSchema);
module.exports = PowerLog;
