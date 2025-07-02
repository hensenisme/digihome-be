const express = require('express');
const router = express.Router();

const {
  getDevices,
  claimDevice,
  updateDevice,
  deleteDevice,
  getClaimStatus,
  setDeviceConfig, // Impor fungsi baru
  enterReProvisioningMode, // Impor fungsi baru
} = require('../controllers/deviceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getDevices);
router.route('/claim-status').get(protect, getClaimStatus);
router.route('/claim').post(protect, claimDevice);
router.route('/:id').put(protect, updateDevice).delete(protect, deleteDevice);

// --- PENAMBAHAN RUTE BARU ---
router.route('/:id/config').put(protect, setDeviceConfig);
router.route('/:id/re-provision').post(protect, enterReProvisioningMode);
// ----------------------------

module.exports = router;