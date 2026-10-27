const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true // Step 8 requirement
  },
  ip: {
    type: String,
    required: true,
    index: true // Step 8 requirement
  },
  username: {
    type: String,
    default: 'anonymous',
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'failed', 'denied'],
    required: true
  },
  userAgent: {
    type: String,
    default: 'Mozilla/5.0'
  },
  endpoint: {
    type: String,
    required: true
  },
  method: {
    type: String,
    default: 'POST'
  },
  statusCode: {
    type: Number,
    default: 200
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  rawPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for time-series range queries by IP
logSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('Log', logSchema);
