const express = require('express');
const router = express.Router();
const { 
  getRooms, 
  addRoom,
  deleteRoom
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware'); // <-- Impor middleware

// PERBAIKAN: Terapkan middleware 'protect' pada semua rute
router.route('/').get(protect, getRooms).post(protect, addRoom);
router.route('/:id').delete(protect, deleteRoom);

module.exports = router;
