const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  // Menambahkan referensi ke model User
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  name: {
    type: String,
    required: true,
  },
  // deviceCount tidak perlu disimpan di DB, karena bisa dihitung secara dinamis
  // dari jumlah perangkat yang memiliki nama ruangan ini.
}, { 
  timestamps: true,
  // Membuat index gabungan untuk memastikan nama ruangan unik per pengguna
  indexes: [{ fields: { owner: 1, name: 1 }, unique: true }]
});

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;
