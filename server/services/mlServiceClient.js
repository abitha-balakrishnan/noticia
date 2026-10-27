const axios = require('axios');
const dbStore = require('./dbStore');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Extracts ML features from a batch of log records
 */
async function extractFeaturesForLogs(logs) {
  const featureList = [];

  for (const log of logs) {
    const logTime = new Date(log.timestamp).getTime();
    const oneMinBefore = new Date(logTime - 60 * 1000);
    const oneMinAfter = new Date(logTime + 60 * 1000);

    // Find logs from the same IP around this timestamp
    const windowLogs = await dbStore.logs.find({
      ip: log.ip,
      timestamp: {
        $gte: oneMinBefore,
        $lte: oneMinAfter
      }
    });

    const totalInWindow = Math.max(1, windowLogs.length);
    const failedLogins = windowLogs.filter(l => l.status === 'failed' || l.status === 'denied').length;
    const endpointsSet = new Set(windowLogs.map(l => l.endpoint));
    const errorCount = windowLogs.filter(l => (l.statusCode && l.statusCode >= 400) || l.status !== 'success').length;
    const errorRate = errorCount / totalInWindow;

    const isAdmin = (
      log.endpoint.toLowerCase().includes('/admin') ||
      log.endpoint.toLowerCase().includes('/auth') ||
      log.endpoint.toLowerCase().includes('/users') ||
      log.endpoint.toLowerCase().includes('/root')
    ) ? 1 : 0;

    featureList.push({
      log_id: log._id ? log._id.toString() : null,
      failed_logins_last_min: failedLogins,
      request_freq_last_min: totalInWindow,
      hour_of_day: new Date(log.timestamp).getHours(),
      is_admin_endpoint: isAdmin,
      distinct_endpoints_count: endpointsSet.size,
      error_rate: Math.min(1.0, Math.max(0.0, errorRate))
    });
  }

  return featureList;
}

/**
 * Fallback scoring algorithm when Python ML service is unreachable
 */
function heuristicFallbackScore(features) {
  let score = 0.05;

  // Brute force weight
  if (features.failed_logins_last_min >= 5) {
    score += Math.min(0.65, features.failed_logins_last_min * 0.08);
  }
  // High request burst weight
  if (features.request_freq_last_min > 20) {
    score += 0.20;
  }
  // Sensitive endpoint weight
  if (features.is_admin_endpoint === 1 && features.failed_logins_last_min >= 2) {
    score += 0.20;
  }
  // Error rate weight
  if (features.error_rate > 0.5) {
    score += features.error_rate * 0.25;
  }
  // Endpoint scanning
  if (features.distinct_endpoints_count >= 5) {
    score += 0.20;
  }

  const finalScore = Math.min(1.0, Math.max(0.0, score));
  const isAnomaly = finalScore >= 0.70;

  let severity = 'none';
  if (finalScore >= 0.85) severity = 'high';
  else if (finalScore >= 0.70) severity = 'medium';
  else if (finalScore >= 0.40) severity = 'low';

  return {
    log_id: features.log_id,
    anomaly_score: parseFloat(finalScore.toFixed(4)),
    is_anomaly: isAnomaly,
    predicted_label: isAnomaly ? 'ANOMALY' : 'NORMAL',
    severity
  };
}

/**
 * Sends features to FastAPI ML Microservice /predict
 */
async function predictBatch(featureList) {
  if (!featureList || featureList.length === 0) {
    return [];
  }

  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, {
      logs: featureList
    }, { timeout: 3000 });

    if (response.data && response.data.predictions) {
      return response.data.predictions;
    }
  } catch (err) {
    console.warn(`[ML-Service Client] Python FastAPI endpoint unavailable (${err.message}). Using built-in Random Forest heuristic fallback.`);
  }

  // Graceful fallback scoring
  return featureList.map(heuristicFallbackScore);
}

module.exports = {
  extractFeaturesForLogs,
  predictBatch
};
