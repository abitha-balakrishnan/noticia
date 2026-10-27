const mongoose = require('mongoose');

let isConnected = false;
let useMemoryFallback = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim() !== '') {
    try {
      console.log('Connecting to MongoDB Atlas at provided MONGODB_URI...');
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      isConnected = true;
      useMemoryFallback = false;
      console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
      return { isConnected: true, fallback: false };
    } catch (err) {
      console.warn(`MongoDB Atlas connection failed (${err.message}). Falling back to local in-memory storage mode.`);
    }
  } else {
    // Check if local mongod is listening
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/noticia', {
        serverSelectionTimeoutMS: 2000,
      });
      isConnected = true;
      useMemoryFallback = false;
      console.log(`Connected to local MongoDB daemon: ${conn.connection.host}`);
      return { isConnected: true, fallback: false };
    } catch (e) {
      console.info('No local MongoDB daemon detected. Using Noticia embedded memory database.');
    }
  }

  // Embedded memory database mode
  isConnected = true;
  useMemoryFallback = true;
  console.log('Noticia SIEM is operating with embedded high-performance memory storage.');
  return { isConnected: true, fallback: true };
};

const getStatus = () => ({
  isConnected,
  useMemoryFallback
});

module.exports = {
  connectDB,
  getStatus
};
