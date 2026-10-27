const mongoose = require('mongoose');

const blockedIPSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  reason: {
    type: String,
    default: 'Suspicious anomaly activity flagged by Noticia SIEM'
  },
  blockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    default: null
  },
  blockedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BlockedIP', blockedIPSchema);
