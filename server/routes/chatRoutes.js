const express = require('express');
const router = express.Router();
const { z } = require('zod');
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/authMiddleware');
const { executeRAGQuery } = require('../services/ragService');

const chatQuerySchema = z.object({
  question: z.string().min(2, 'Question must be at least 2 characters')
});

// POST /api/chat/query - Two-Stage Grounded RAG Chat
router.post('/query', authMiddleware, async (req, res) => {
  try {
    const parseResult = chatQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0].message
      });
    }

    const { question } = parseResult.data;

    // Run grounded RAG query
    const ragResult = await executeRAGQuery(question);

    // Save interaction to ChatHistory audit log
    const historyDoc = await dbStore.chatHistory.create({
      userId: req.user.id,
      question,
      generatedQuery: ragResult.generatedQuery,
      resultCount: ragResult.resultCount,
      answer: ragResult.answer,
      createdAt: new Date()
    });

    return res.json({
      success: true,
      data: {
        id: historyDoc._id,
        question,
        generatedQuery: ragResult.generatedQuery,
        resultCount: ragResult.resultCount,
        answer: ragResult.answer,
        records: ragResult.records,
        createdAt: historyDoc.createdAt
      }
    });
  } catch (error) {
    console.error('Chat query route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process natural language security query'
    });
  }
});

// GET /api/chat/history - Retrieve user chat session history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await dbStore.chatHistory.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Fetch chat history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history'
    });
  }
});

module.exports = router;
