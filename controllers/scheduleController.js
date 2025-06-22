// controllers/scheduleController.js

const Schedule = require('../models/Schedule');
const Device = require('../models/Device');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Get all schedules for the logged-in user
// @route   GET /api/schedules
// @access  Private
const getAllUserSchedules = asyncHandler(async (req, res) => {
  const schedules = await Schedule.find({ owner: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(schedules);
});

// @desc    Membuat jadwal baru untuk sebuah perangkat
// @route   POST /api/schedules
// @access  Private
const createSchedule = asyncHandler(async (req, res) => {
  const {
    deviceId,
    scheduleName,
    startTime,
    endTime,
    days,
    action,
    isEnabled,
  } = req.body;

  if (!deviceId || !scheduleName || !startTime || !endTime || !days || !action) {
    res.status(400);
    throw new Error('Mohon lengkapi semua field yang diperlukan.');
  }

  // --- PERBAIKAN KRUSIAL: Gunakan field 'deviceId' untuk query ---
  const device = await Device.findOne({
    deviceId: deviceId, // Query berdasarkan field 'deviceId' yang benar
    owner: req.user._id,
  });

  if (!device) {
    res.status(404);
    throw new Error('Perangkat tidak ditemukan atau Anda tidak berwenang.');
  }

  const schedule = new Schedule({
    owner: req.user._id,
    deviceId: device.deviceId, // Pastikan kita menyimpan deviceId yang sama
    scheduleName,
    startTime,
    endTime,
    days,
    action,
    isEnabled,
  });

  const createdSchedule = await schedule.save();
  res.status(201).json(createdSchedule);
});


// @desc    Mengambil semua jadwal untuk satu perangkat
// @route   GET /api/schedules/device/:deviceId
// @access  Private
const getSchedulesForDevice = asyncHandler(async (req, res) => {
  const schedules = await Schedule.find({
    owner: req.user._id,
    deviceId: req.params.deviceId,
  });
  res.json(schedules);
});


// @desc    Memperbarui sebuah jadwal
// @route   PUT /api/schedules/:id
// @access  Private
const updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);

  if (schedule && schedule.owner.toString() === req.user._id.toString()) {
    schedule.scheduleName = req.body.scheduleName || schedule.scheduleName;
    schedule.startTime = req.body.startTime || schedule.startTime;
    schedule.endTime = req.body.endTime || schedule.endTime;
    schedule.days = req.body.days || schedule.days;
    schedule.action = req.body.action || schedule.action;
    schedule.isEnabled = req.body.isEnabled ?? schedule.isEnabled;

    const updatedSchedule = await schedule.save();
    res.json(updatedSchedule);
  } else {
    res.status(404);
    throw new Error('Jadwal tidak ditemukan atau tidak berwenang.');
  }
});

// @desc    Menghapus sebuah jadwal
// @route   DELETE /api/schedules/:id
// @access  Private
const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);

  if (schedule && schedule.owner.toString() === req.user._id.toString()) {
    await schedule.deleteOne();
    res.json({ message: 'Jadwal berhasil dihapus.' });
  } else {
    res.status(404);
    throw new Error('Jadwal tidak ditemukan atau tidak berwenang.');
  }
});


module.exports = {
  getAllUserSchedules,
  createSchedule,
  getSchedulesForDevice,
  updateSchedule,
  deleteSchedule,
};
