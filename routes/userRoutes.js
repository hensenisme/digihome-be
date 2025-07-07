// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  registerFcmToken, 
  testBudgetNotification,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);

// Rute baru untuk mendaftarkan token FCM
router.post('/fcm-token', protect, registerFcmToken);
router.get('/test-budget-notif', protect, testBudgetNotification);

module.exports = router;
