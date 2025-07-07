// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fcmTokens: {
      type: [String],
      default: [],
    },
    // ================== FIELD BARU UNTUK BUDGET & TARIF ==================
    settings: {
      monthlyBudget: {
        type: Number,
        default: 250000, // Anggaran default Rp 250.000
      },
      tariffTier: {
        type: String,
        enum: ['tier900', 'tier1300', 'tier2200', 'other'],
        default: 'tier1300', // Golongan tarif default
      },
      // Menambahkan flag untuk memastikan notifikasi budget hanya dikirim sekali per bulan
      budgetNotificationSent: {
        month: { type: Number, default: 0 }, // Menyimpan bulan (1-12)
        year: { type: Number, default: 0 }, // Menyimpan tahun
      },
    },
    // ======================================================================
  },
  { timestamps: true }
);

// Middleware dan method lainnya tidak berubah
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
