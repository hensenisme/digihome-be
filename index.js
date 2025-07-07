// index.js

const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const { WebSocketServer } = require('ws');
const url = require('url');
const jwt = require('jsonwebtoken');
const notificationRoutes = require('./routes/notificationRoutes');

const connectDB = require('./config/db');
const { connectMqtt } = require('./services/mqtt_service');
// const { startRealtimeSimulation } = require('./services/realtime_service'); // Sudah tidak dipakai
const { startScheduler } = require('./services/scheduler_service');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const powerLogRoutes = require('./routes/powerLogRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');


dotenv.config();

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clientConnections = new Map();

wss.on('connection', (ws, req) => {
  const token = url.parse(req.url, true).query.token;
  if (!token) {
    console.log('[WebSocket] Koneksi ditolak: Tidak ada token.');
    return ws.terminate();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    console.log(`[WebSocket] Klien terhubung untuk user: ${userId}`);
    clientConnections.set(userId, ws);

    ws.on('close', () => {
      console.log(`[WebSocket] Klien terputus untuk user: ${userId}`);
      clientConnections.delete(userId);
    });
    ws.on('error', (error) => {
      console.error(`[WebSocket] Error untuk user ${userId}:`, error);
      clientConnections.delete(userId);
    });
  } catch (error) {
    console.log('[WebSocket] Koneksi ditolak: Token tidak valid.');
    ws.terminate();
  }
});

app.get('/api', (req, res) => res.send('API sedang berjalan...'));

// Daftarkan semua rute
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/logs', powerLogRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
// Error Middleware
app.use(notFound);
app.use(errorHandler);


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    // Berikan clientConnections ke service MQTT agar bisa meneruskan data
    connectMqtt(clientConnections); 
    
    server.listen(PORT, () => console.log(`[Server] Berjalan di port ${PORT}`));
    
    // Jalankan service latar belakang
    startScheduler(clientConnections);
    
  } catch (error) {
    console.error('[Server] Gagal memulai server:', error);
    process.exit(1);
  }
};

startServer();
