// routes/deviceRoutes.js
const express = require('express');
const router = express.Router();

const {
  getDevices,
  claimDevice,
  updateDevice,
  deleteDevice,
  getClaimStatus, // Impor fungsi baru
} = require('../controllers/deviceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getDevices);

// Rute baru untuk polling status klaim
router.route('/claim-status').get(protect, getClaimStatus);

router.route('/claim').post(protect, claimDevice);
router.route('/:id').put(protect, updateDevice).delete(protect, deleteDevice);

module.exports = router;
