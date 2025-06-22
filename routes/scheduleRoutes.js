// routes/scheduleRoutes.js

const express = require('express');
const router = express.Router();
const {
  getAllUserSchedules, // <-- IMPORT BARU
  createSchedule,
  getSchedulesForDevice,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');

// --- PERBAIKAN: Gabungkan GET dan POST untuk root route ---
router
  .route('/')
  .get(protect, getAllUserSchedules) // <-- ROUTE BARU
  .post(protect, createSchedule);

router
  .route('/:id')
  .put(protect, updateSchedule)
  .delete(protect, deleteSchedule);

router.route('/device/:deviceId').get(protect, getSchedulesForDevice);

module.exports = router;
