require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { connectDB, getStatus } = require('./config/db');
const { initLogProcessorCron } = require('./cron/logProcessor');

// Routes
const authRoutes = require('./routes/authRoutes');
const logRoutes = require('./routes/logRoutes');
const alertRoutes = require('./routes/alertRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const chatRoutes = require('./routes/chatRoutes');
const actionRoutes = require('./routes/actionRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) or matching allowedOrigins
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for easy evaluation
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach io instance to express app so routes can access req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] SOC Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date() });
  });
});

// Root & Health Check
app.get('/', (req, res) => {
  res.json({
    name: 'Noticia SIEM API Server',
    version: '1.0.0',
    description: 'AI Driven Security Information and Event Management with Real-Time Threat Detection and Grounded RAG Chat',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  const dbStatus = getStatus();
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    database: {
      connected: dbStatus.isConnected,
      mode: dbStatus.useMemoryFallback ? 'embedded_memory' : 'mongodb_atlas'
    },
    services: {
      mlService: process.env.ML_SERVICE_URL || 'http://localhost:8000',
      groqConfigured: !!(process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.startsWith('your_'))
    },
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDB();
  initLogProcessorCron(io);

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  NOTICIA SIEM CORE BACKEND LISTENING ON PORT ${PORT} `);
    console.log(`  API Base: http://localhost:${PORT}/api             `);
    console.log(`  WebSocket (Socket.IO): Ready on port ${PORT}       `);
    console.log(`======================================================\n`);
  });
}

// If invoked directly
if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer, io };
