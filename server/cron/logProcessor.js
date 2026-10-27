const cron = require('node-cron');
const dbStore = require('../services/dbStore');
const { extractFeaturesForLogs, predictBatch } = require('../services/mlServiceClient');

let isProcessing = false;

async function processUnprocessedLogs(io) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    // 1. Fetch unprocessed logs (limit batch size to 50 for fast responsiveness)
    const unprocessed = await dbStore.logs.find({ processed: false })
      .sort({ timestamp: 1 })
      .limit(50);

    if (!unprocessed || unprocessed.length === 0) {
      isProcessing = false;
      return;
    }

    console.log(`[ML Pipeline] Processing batch of ${unprocessed.length} unprocessed security log(s)...`);

    // 2. Extract features
    const featureBatch = await extractFeaturesForLogs(unprocessed);

    // 3. Score with ML microservice
    const predictions = await predictBatch(featureBatch);

    // 4. Evaluate scores and create alerts
    const alertsToEmit = [];

    for (let i = 0; i < unprocessed.length; i++) {
      const log = unprocessed[i];
      const pred = predictions[i] || { anomaly_score: 0.1, is_anomaly: false, severity: 'none' };

      // Threshold check: alert if anomaly_score >= 0.70
      if (pred.anomaly_score >= 0.70) {
        const severity = pred.severity !== 'none' ? pred.severity : (pred.anomaly_score >= 0.85 ? 'high' : 'medium');
        
        const alertDoc = await dbStore.alerts.create({
          logId: log._id,
          ip: log.ip,
          username: log.username || 'anonymous',
          anomalyScore: pred.anomaly_score,
          severity: severity,
          status: 'open',
          details: {
            endpoint: log.endpoint,
            method: log.method,
            statusCode: log.statusCode,
            reason: pred.anomaly_score >= 0.85 
              ? `High-risk brute-force / anomalous pattern detected from ${log.ip} (Score: ${pred.anomaly_score})`
              : `Suspicious activity pattern identified from ${log.ip} (Score: ${pred.anomaly_score})`,
            features: featureBatch[i]
          },
          createdAt: new Date()
        });

        alertsToEmit.push(alertDoc);
      }
    }

    // 5. Mark logs as processed
    const processedIds = unprocessed.map(l => l._id);
    await dbStore.logs.updateMany(
      { _id: { $in: processedIds } },
      { $set: { processed: true } }
    );

    // 6. Push real-time alerts via Socket.IO
    if (io && alertsToEmit.length > 0) {
      alertsToEmit.forEach(alertData => {
        console.log(`[Socket.IO] Emitting 'new_alert': [${alertData.severity.toUpperCase()}] ${alertData.ip} - ${alertData.anomalyScore}`);
        io.emit('new_alert', alertData);
      });
    }

    if (alertsToEmit.length > 0) {
      console.log(`[ML Pipeline] Generated ${alertsToEmit.length} threat alert(s) from batch.`);
    }
  } catch (error) {
    console.error('[ML Pipeline] Error during log processing:', error.message);
  } finally {
    isProcessing = false;
  }
}

/**
 * Initializes the background cron worker running every 10 seconds
 */
function initLogProcessorCron(io) {
  console.log('[Cron] Initializing ML threat detection scheduler (interval: every 10s)...');
  // Runs every 10 seconds: */10 * * * * *
  const task = cron.schedule('*/10 * * * * *', () => {
    processUnprocessedLogs(io);
  });
  return task;
}

module.exports = {
  processUnprocessedLogs,
  initLogProcessorCron
};
