const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

// Middleware yang berjalan SEBELUM data disimpan (.pre('save', ...))
userSchema.pre('save', async function (next) {
  // Hanya lakukan hashing jika password diubah (atau baru)
  if (!this.isModified('password')) {
    next();
  }

  // Generate "salt" untuk memperkuat hash, lalu hash password-nya
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method untuk membandingkan password yang dimasukkan dengan hash di database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
