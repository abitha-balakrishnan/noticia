const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  logId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Log',
    required: true
  },
  ip: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    default: 'anonymous'
  },
  anomalyScore: {
    type: Number,
    required: true
  },
  severity: {
    type: String,
    enum: ['high', 'medium', 'low'],
    required: true,
    index: true // Step 8 requirement
  },
  status: {
    type: String,
    enum: ['open', 'actioned', 'resolved'],
    default: 'open',
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for dashboard sorting and filtering
alertSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
