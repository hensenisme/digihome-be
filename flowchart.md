graph TD
A[Mulai Aplikasi] --> B{Splash Screen<br>Cek Token Login Tersimpan}
B -- "Token Ada" --> C[Hubungkan ke WebSocket dan Sinkronisasi Data]
B -- "Token Tidak Ada" --> D[Tampilkan Halaman Login]
D --> E{Pengguna Masukkan Kredensial}
E -- "Gagal" --> F[Tampilkan Pesan Error]
F --> D
E -- "Berhasil" --> G[Simpan Token dan Kirim FCM Token ke Backend]
G --> C
C --> H[Tampilkan Halaman Utama Dashboard]

    subgraph "Interaksi di Halaman Utama"
        H --> I{Pilih Menu}
        I -- "Kontrol Perangkat" --> J[Kirim Perintah ON/OFF via API]
        J --> K[Backend Kirim Perintah via MQTT]
        K --> L{UI Menunggu Konfirmasi Status dari WebSocket}
        L --> H
        I -- "Tambah Perangkat" --> M[Mulai Alur Provisioning<br>Pindai QR atau BLE]
        M --> N[Kirim Kredensial WiFi dan Lakukan Klaim Perangkat]
        N --> H
        I -- "Lihat Statistik" --> O[Tampilkan Halaman Statistik]
        O --> H
    end
