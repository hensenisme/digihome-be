// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  markAsRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

// Route untuk GET /api/notifications -> akan memanggil getUserNotifications
router.route('/').get(protect, getUserNotifications);

// Route untuk PUT /api/notifications/:id/read -> akan memanggil markAsRead
router.route('/:id/read').put(protect, markAsRead);

module.exports = router;
