const PowerLog = require('../models/PowerLog');

// @desc    Ambil semua log data, bisa difilter berdasarkan deviceId
// @route   GET /api/logs
// @route   GET /api/logs?deviceId=xxxxx
const getPowerLogs = async (req, res) => {
  try {
    let query = {};
    
    // Jika ada parameter deviceId di URL, tambahkan ke filter query
    if (req.query.deviceId) {
      query.deviceId = req.query.deviceId;
    }

    // Ambil data dari MongoDB, urutkan dari yang terbaru, batasi 1000 data terakhir
    const logs = await PowerLog.find(query).sort({ timestamp: -1 }).limit(1000);
    
    res.json(logs);
  } catch (error) {
    console.error(`Error fetching logs: ${error.message}`);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getPowerLogs };
