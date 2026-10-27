const express = require('express');
const router = express.Router();
const { z } = require('zod');
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

const blockIpSchema = z.object({
  ip: z.string().min(1, 'IP address is required'),
  alertId: z.string().optional().nullable(),
  reason: z.string().optional()
});

// GET /api/actions/blocked-ips - List currently blocked IPs
router.get('/blocked-ips', authMiddleware, async (req, res) => {
  try {
    const list = await dbStore.blockedIPs.find({})
      .sort({ blockedAt: -1 });

    // Populate user name if available
    const enriched = await Promise.all(list.map(async item => {
      let blockerName = 'SOC Administrator';
      if (item.blockedBy) {
        const u = await dbStore.users.findById(item.blockedBy);
        if (u) blockerName = `${u.name} (${u.role})`;
      }
      return {
        _id: item._id,
        ip: item.ip,
        reason: item.reason,
        blockedBy: item.blockedBy,
        blockerName,
        alertId: item.alertId,
        blockedAt: item.blockedAt
      };
    }));

    return res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('Fetch blocked IPs error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve blocked IPs list'
    });
  }
});

// POST /api/actions/block-ip - Admin-only route to block an IP
router.post('/block-ip', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const parseResult = blockIpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0].message
      });
    }

    const { ip, alertId, reason } = parseResult.data;
    const cleanIp = ip.trim();

    // Check if already blocked
    const existing = await dbStore.blockedIPs.findOne({ ip: cleanIp });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `IP ${cleanIp} is already blocked`
      });
    }

    // Insert into blocked_ips
    const record = await dbStore.blockedIPs.create({
      ip: cleanIp,
      reason: reason || 'Manual SOC Admin mitigation for malicious traffic / brute force pattern',
      blockedBy: req.user.id,
      alertId: alertId || null,
      blockedAt: new Date()
    });

    // If an alertId was provided, update alert status to "actioned"
    if (alertId) {
      await dbStore.alerts.findByIdAndUpdate(alertId, {
        $set: { status: 'actioned' }
      });
    }

    // Also update any other open alerts from this exact IP to actioned
    await dbStore.alerts.find({ ip: cleanIp, status: 'open' }).then(async alerts => {
      for (const a of alerts) {
        await dbStore.alerts.findByIdAndUpdate(a._id, { $set: { status: 'actioned' } });
      }
    });

    console.log(`[ACTION LOG] IP ${cleanIp} blocked by Admin ${req.user.name} (${req.user.email}) at ${new Date().toISOString()}`);

    return res.status(201).json({
      success: true,
      message: `IP ${cleanIp} has been blocked successfully`,
      data: record
    });
  } catch (error) {
    console.error('Block IP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to block IP'
    });
  }
});

// DELETE /api/actions/block-ip/:id - Admin-only route to unblock an IP
router.delete('/block-ip/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const record = await dbStore.blockedIPs.findById(req.params.id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Blocked IP record not found'
      });
    }

    await dbStore.blockedIPs.findByIdAndDelete(req.params.id);

    console.log(`[ACTION LOG] IP ${record.ip} unblocked by Admin ${req.user.name} (${req.user.email}) at ${new Date().toISOString()}`);

    return res.json({
      success: true,
      message: `IP ${record.ip} has been unblocked`
    });
  } catch (error) {
    console.error('Unblock IP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unblock IP'
    });
  }
});

module.exports = router;
