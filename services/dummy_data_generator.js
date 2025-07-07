// File: services/dummy_data_generator.js
// TUJUAN: Untuk mengisi perangkat dummy (AC, TV, dll.) dengan data historis
// agar halaman statistik di aplikasi terlihat fungsional.

const mongoose = require('mongoose');
const dotenv =require('dotenv');
const connectDB = require('../config/db');
const Device = require('../models/Device');
const PowerLog = require('../models/PowerLog');

dotenv.config();

// Profil konsumsi daya untuk setiap tipe perangkat dummy.
// Anda bisa menyesuaikan nilai-nilai ini agar lebih realistis.
const deviceProfiles = {
  ac:           { basePower: 1200, powerVariance: 400 }, // Konsumsi tinggi
  smartTv:      { basePower: 80,   powerVariance: 30  },
  refridgerator:{ basePower: 150,  powerVariance: 50  }, // Kulkas cenderung stabil
  microwave:    { basePower: 900,  powerVariance: 200 },
  cctv:         { basePower: 15,   powerVariance: 5   }, // Konsumsi rendah dan konstan
  light:        { basePower: 12,   powerVariance: 4   },
  // 'plug' tidak dimasukkan karena diasumsikan datanya datang dari perangkat fisik
};

/**
 * Fungsi utama untuk membuat data historis.
 */
const populateHistoricalData = async () => {
  try {
    console.log('Memulai proses pembuatan data historis untuk perangkat dummy...');
    
    // 1. Ambil semua perangkat yang ada di database
    const allDevices = await Device.find({});
    
    if (allDevices.length === 0) {
      console.log('Tidak ada perangkat ditemukan. Proses dihentikan.');
      return;
    }

    // 2. Loop melalui setiap perangkat
    for (const device of allDevices) {
      // Hanya proses perangkat yang tipenya ada di dalam profil dummy kita
      if (!deviceProfiles[device.type]) {
        console.log(`--> Melewati '${device.name}' (Tipe: ${device.type}), bukan perangkat dummy.`);
        continue;
      }

      // Cek apakah perangkat ini sudah memiliki data log
      const existingLog = await PowerLog.findOne({ deviceId: device.id });
      if (existingLog) {
        console.log(`--> Melewati '${device.name}', data historis sudah ada.`);
        continue;
      }

      console.log(`==> MEMBUAT DATA untuk '${device.name}' (Tipe: ${device.type})`);
      
      const profile = deviceProfiles[device.type];
      const logsToInsert = [];
      let accumulatedEnergyKWh = 0;

      const now = new Date();

      // 3. Buat data selama 60 hari terakhir
      for (let day = 60; day >= 0; day--) {
        // Buat beberapa titik data per hari untuk simulasi yang lebih baik
        const pointsPerDay = Math.floor(Math.random() * 5) + 3; // 3-7 data points
        
        for (let point = 0; point < pointsPerDay; point++) {
          const timestamp = new Date(now.getTime() - (day * 24 * 60 * 60 * 1000) - (point * 3 * 60 * 60 * 1000));
          
          const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
          const hour = timestamp.getHours();
          
          // Simulasi pemakaian lebih tinggi di malam hari dan akhir pekan
          const usageMultiplier = (hour >= 18 || hour <= 6 || isWeekend) ? 1.5 : 0.8;

          const power = (profile.basePower + (Math.random() * profile.powerVariance)) * usageMultiplier;
          const voltage = 220 + (Math.random() * 10 - 5); // 215V - 225V
          const powerFactor = 0.85 + (Math.random() * 0.1); // 0.85 - 0.95
          const current = power / (voltage * powerFactor);
          
          // Akumulasi energi (simulasi sederhana)
          accumulatedEnergyKWh += (power / 1000) * (24 / pointsPerDay); // Asumsi interval jam

          logsToInsert.push({
            deviceId: device.id,
            timestamp,
            voltage,
            current,
            power,
            energyKWh: accumulatedEnergyKWh,
            powerFactor,
            active: Math.random() > 0.3 // 70% kemungkinan perangkat aktif saat ada log
          });
        }
      }

      // 4. Simpan semua log yang telah dibuat untuk perangkat ini ke database
      if (logsToInsert.length > 0) {
        await PowerLog.insertMany(logsToInsert);
        console.log(`    --- Berhasil menyimpan ${logsToInsert.length} data log historis.`);
      }
    }

    console.log('\nProses pembuatan data historis selesai.');

  } catch (error) {
    console.error('Terjadi kesalahan saat membuat data historis:', error);
  } finally {
    // Tutup koneksi database setelah selesai
    await mongoose.disconnect();
    console.log('Koneksi database ditutup.');
  }
};

// Hubungkan ke DB dan jalankan fungsi utama
connectDB().then(() => {
  populateHistoricalData();
});
