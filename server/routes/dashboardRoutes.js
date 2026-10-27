const express = require('express');
const router = express.Router();
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/dashboard/summary
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Stat Card Counts
    const totalLogsToday = await dbStore.logs.countDocuments({
      timestamp: { $gte: startOfToday }
    });

    const activeAlerts = await dbStore.alerts.countDocuments({
      status: { $in: ['open', 'actioned'] }
    });

    const blockedIpsCount = await dbStore.blockedIPs.countDocuments({});

    // 2. Severity Distribution for Pie Chart
    const highAlerts = await dbStore.alerts.countDocuments({ severity: 'high' });
    const mediumAlerts = await dbStore.alerts.countDocuments({ severity: 'medium' });
    const lowAlerts = await dbStore.alerts.countDocuments({ severity: 'low' });

    const severityDistribution = [
      { name: 'High', value: highAlerts, color: '#ef4444' },     // red
      { name: 'Medium', value: mediumAlerts, color: '#f97316' }, // orange
      { name: 'Low', value: lowAlerts, color: '#eab308' }        // yellow
    ];

    // 3. Alerts Over Time (Last 24 Hours, hourly buckets for Line Chart)
    const recentAlertsAll = await dbStore.alerts.find({
      createdAt: { $gte: twentyFourHoursAgo }
    }).sort({ createdAt: 1 });

    // Group by hour
    const hourlyMap = {};
    for (let i = 23; i >= 0; i--) {
      const bucketTime = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = bucketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      hourlyMap[label] = {
        time: label,
        total: 0,
        high: 0,
        medium: 0,
        low: 0
      };
    }

    recentAlertsAll.forEach(alert => {
      const alertTime = new Date(alert.createdAt);
      const label = alertTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (hourlyMap[label]) {
        hourlyMap[label].total += 1;
        if (alert.severity === 'high') hourlyMap[label].high += 1;
        else if (alert.severity === 'medium') hourlyMap[label].medium += 1;
        else if (alert.severity === 'low') hourlyMap[label].low += 1;
      }
    });

    const alertsOverTime = Object.values(hourlyMap);

    // 4. Last 5 Recent Alerts for Dashboard Table
    const recentAlerts = await dbStore.alerts.find({})
      .sort({ createdAt: -1 })
      .limit(5);

    return res.json({
      success: true,
      data: {
        stats: {
          totalLogsToday,
          activeAlerts,
          blockedIpsCount
        },
        severityDistribution,
        alertsOverTime,
        recentAlerts
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard summary'
    });
  }
});

module.exports = router;
