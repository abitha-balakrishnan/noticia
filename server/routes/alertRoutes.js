const express = require('express');
const router = express.Router();
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/authMiddleware');
const { processUnprocessedLogs } = require('../cron/logProcessor');

// GET /api/alerts - List alerts with filtering and pagination
router.get('/', authMiddleware, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      severity,
      status,
      ip,
      from,
      to
    } = req.query;

    const query = {};

    if (severity && severity.toLowerCase() !== 'all') {
      query.severity = severity.toLowerCase();
    }
    if (status) {
      query.status = status;
    }
    if (ip) {
      query.ip = { $regex: ip.trim(), $options: 'i' };
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const total = await dbStore.alerts.countDocuments(query);
    const alerts = await dbStore.alerts.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    return res.json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data: alerts
    });
  } catch (error) {
    console.error('Fetch alerts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts'
    });
  }
});

// GET /api/alerts/:id - Fetch single alert details including raw log & IP history
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const alert = await dbStore.alerts.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Fetch corresponding raw log
    let rawLog = null;
    if (alert.logId) {
      rawLog = await dbStore.logs.findById(alert.logId);
    }

    // Fetch related logs from the same IP (up to 20 recent logs)
    const relatedLogs = await dbStore.logs.find({ ip: alert.ip })
      .sort({ timestamp: -1 })
      .limit(20);

    // Check if IP is currently blocked
    const blockedRecord = await dbStore.blockedIPs.findOne({ ip: alert.ip });

    return res.json({
      success: true,
      data: {
        alert,
        rawLog,
        relatedLogs,
        isBlocked: !!blockedRecord,
        blockedInfo: blockedRecord || null
      }
    });
  } catch (error) {
    console.error('Get alert detail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert details'
    });
  }
});

// PATCH /api/alerts/:id/status - Update alert resolution status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'actioned', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be open, actioned, or resolved'
      });
    }

    const updated = await dbStore.alerts.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    return res.json({
      success: true,
      message: `Alert marked as ${status}`,
      data: updated
    });
  } catch (error) {
    console.error('Update alert status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update alert status'
    });
  }
});

// POST /api/alerts/process - Immediate trigger of ML detection on unprocessed logs
router.post('/process', async (req, res) => {
  try {
    const configuredKey = process.env.SERVICE_KEY || 'noticia_internal_service_key_987654321';
    const providedKey = req.headers['x-service-key'] || req.query.service_key;
    const authHeader = req.headers.authorization;

    // Allow if service key matches OR if bearer token is present
    if (!providedKey || providedKey !== configuredKey) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authorization required (Bearer token or x-service-key)'
        });
      }
    }

    const io = req.app.get('io');
    await processUnprocessedLogs(io);
    return res.json({
      success: true,
      message: 'Triggered immediate ML processing of unprocessed logs'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error triggering ML processing: ' + error.message
    });
  }
});

module.exports = router;
