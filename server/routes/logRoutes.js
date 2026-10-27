const express = require('express');
const router = express.Router();
const { z } = require('zod');
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/authMiddleware');
const serviceAuthMiddleware = require('../middleware/serviceAuthMiddleware');

const singleLogSchema = z.object({
  timestamp: z.string().or(z.date()).optional(),
  ip: z.string().min(1, 'IP is required'),
  username: z.string().default('anonymous'),
  status: z.enum(['success', 'failed', 'denied']),
  userAgent: z.string().optional().default('Mozilla/5.0'),
  endpoint: z.string().min(1, 'Endpoint is required'),
  method: z.string().optional().default('POST'),
  statusCode: z.number().int().optional().default(200),
  rawPayload: z.any().optional()
});

const ingestSchema = z.union([
  singleLogSchema,
  z.array(singleLogSchema)
]);

// POST /api/logs/ingest - Ingestion endpoint for sensors/simulators
router.post('/ingest', serviceAuthMiddleware, async (req, res) => {
  try {
    const parseResult = ingestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid log event structure',
        errors: parseResult.error.errors
      });
    }

    const payload = parseResult.data;
    const logsToSave = Array.isArray(payload) ? payload : [payload];

    const preparedLogs = logsToSave.map(item => ({
      timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
      ip: item.ip.trim(),
      username: item.username ? item.username.trim() : 'anonymous',
      status: item.status,
      userAgent: item.userAgent || 'Mozilla/5.0',
      endpoint: item.endpoint.trim(),
      method: (item.method || 'POST').toUpperCase(),
      statusCode: item.statusCode || (item.status === 'success' ? 200 : 401),
      processed: false,
      rawPayload: item.rawPayload || null,
      createdAt: new Date()
    }));

    const saved = await dbStore.logs.insertMany(preparedLogs);

    return res.status(201).json({
      success: true,
      message: `Successfully ingested ${saved.length} log event(s)`,
      count: saved.length,
      data: saved.slice(0, 5) // Return sample
    });
  } catch (error) {
    console.error('Log ingestion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to ingest log event'
    });
  }
});

// GET /api/logs - List security logs with filtering and pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      ip,
      username,
      status,
      endpoint,
      from,
      to
    } = req.query;

    const query = {};

    if (ip) {
      query.ip = { $regex: ip.trim(), $options: 'i' };
    }
    if (username) {
      query.username = { $regex: username.trim(), $options: 'i' };
    }
    if (status) {
      query.status = status;
    }
    if (endpoint) {
      query.endpoint = { $regex: endpoint.trim(), $options: 'i' };
    }
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await dbStore.logs.countDocuments(query);
    const logs = await dbStore.logs.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data: logs
    });
  } catch (error) {
    console.error('Fetch logs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve logs'
    });
  }
});

module.exports = router;
