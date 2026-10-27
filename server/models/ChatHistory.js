const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true
  },
  generatedQuery: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  resultCount: {
    type: Number,
    required: true,
    default: 0
  },
  answer: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
