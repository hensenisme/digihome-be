const Room = require('../models/Room');
const Device = require('../models/Device');

// @desc    Get all rooms for a logged-in user
// @route   GET /api/rooms
const getRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ owner: req.user._id });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Add a new room for a logged-in user
// @route   POST /api/rooms
const addRoom = async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Nama ruangan tidak boleh kosong' });
  }

  try {
    const roomExists = await Room.findOne({ owner: req.user._id, name });
    if (roomExists) {
      return res.status(400).json({ message: 'Nama ruangan sudah ada' });
    }

    const room = new Room({
      name,
      owner: req.user._id,
    });

    const createdRoom = await room.save();
    res.status(201).json(createdRoom);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a room owned by the user
// @route   DELETE /api/rooms/:id
const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    // Cek kepemilikan ruangan
    if (!room || room.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Ruangan tidak ditemukan' });
    }

    // Cek apakah masih ada perangkat di dalam ruangan ini
    const devicesInRoom = await Device.countDocuments({ owner: req.user._id, room: room.name });
    if (devicesInRoom > 0) {
      return res.status(400).json({ message: 'Tidak bisa menghapus ruangan yang masih berisi perangkat' });
    }
    
    await room.deleteOne();
    res.json({ message: 'Ruangan berhasil dihapus' });

  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = { getRooms, addRoom, deleteRoom };
