const express = require('express');
const router = express.Router();
const { getPowerLogs } = require('../controllers/powerLogController');

// Definisikan rute untuk endpoint /api/logs
// Saat URL ini diakses dengan metode GET, ia akan menjalankan fungsi getPowerLogs
router.route('/').get(getPowerLogs);

module.exports = router;
