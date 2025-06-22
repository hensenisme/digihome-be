// models/Schedule.js

const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    deviceId: {
      type: String, // Kita gunakan deviceId unik dari model Device
      required: true,
    },
    scheduleName: {
      type: String,
      required: true,
    },
    startTime: {
      type: String, // Format "HH:mm" e.g., "08:00"
      required: true,
    },
    endTime: {
      type: String, // Format "HH:mm" e.g., "22:30"
      required: true,
    },
    days: {
      type: [String], // e.g., ["Sen", "Sel", "Rab"]
      required: true,
    },
    action: {
      type: String, // "ON" or "OFF"
      required: true,
      enum: ['ON', 'OFF'],
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      // Index untuk memastikan nama jadwal unik per perangkat milik satu user
      { fields: { owner: 1, deviceId: 1, scheduleName: 1 }, unique: true },
    ],
  }
);

const Schedule = mongoose.model('Schedule', scheduleSchema);

module.exports = Schedule;
