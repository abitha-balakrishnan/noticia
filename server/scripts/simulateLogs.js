/**
 * Noticia SIEM - Realistic Security Log Generator & Attack Simulator
 * Simulates normal enterprise activity and realistic attack patterns:
 * 1. Distributed normal employee traffic
 * 2. High-frequency brute-force login attack on /api/auth/login
 * 3. Unauthorized admin endpoint fuzzing / privilege escalation probe
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_URL = process.env.SERVER_URL || 'http://localhost:5000';
const SERVICE_KEY = process.env.SERVICE_KEY || 'noticia_internal_service_key_987654321';

const NORMAL_USERS = ['alice_ops', 'bob_analyst', 'carol_soc', 'david_dev', 'emma_sec'];
const NORMAL_IPS = ['192.168.1.15', '192.168.1.42', '10.0.4.88', '10.0.5.12', '172.16.0.25'];
const NORMAL_ENDPOINTS = [
  '/api/dashboard/summary',
  '/api/reports/daily',
  '/api/alerts',
  '/api/profile/settings',
  '/api/auth/login'
];

const ATTACK_IPS = {
  BRUTE_FORCE: '203.0.113.88',
  PROBING: '198.51.100.142'
};

function generateNormalLog(timestamp) {
  const ip = NORMAL_IPS[Math.floor(Math.random() * NORMAL_IPS.length)];
  const user = NORMAL_USERS[Math.floor(Math.random() * NORMAL_USERS.length)];
  const endpoint = NORMAL_ENDPOINTS[Math.floor(Math.random() * NORMAL_ENDPOINTS.length)];
  return {
    timestamp: timestamp || new Date(),
    ip,
    username: user,
    status: 'success',
    endpoint,
    method: endpoint.includes('login') ? 'POST' : 'GET',
    statusCode: 200,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
  };
}

function generateBruteForceBurst(count = 15, baseTime = new Date()) {
  const logs = [];
  const targetUsers = ['admin', 'root', 'administrator', 'system', 'superadmin', 'admin'];

  for (let i = 0; i < count; i++) {
    // Events spaced 1-2 seconds apart
    const eventTime = new Date(baseTime.getTime() - (count - i) * 1500);
    logs.push({
      timestamp: eventTime,
      ip: ATTACK_IPS.BRUTE_FORCE,
      username: targetUsers[i % targetUsers.length],
      status: 'failed',
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 401,
      userAgent: 'Python-urllib/3.10 (Hydra-v9.5)',
      rawPayload: { attempt: i + 1, password_length: 8 + (i % 4) }
    });
  }

  return logs;
}

function generateAdminProbeBurst(count = 8, baseTime = new Date()) {
  const logs = [];
  const sensitiveEndpoints = [
    '/admin/config.env',
    '/admin/backup.tar.gz',
    '/api/users/export',
    '/admin/database_dump',
    '/api/auth/superuser',
    '/admin/system/reboot'
  ];

  for (let i = 0; i < count; i++) {
    const eventTime = new Date(baseTime.getTime() - (count - i) * 2000);
    logs.push({
      timestamp: eventTime,
      ip: ATTACK_IPS.PROBING,
      username: 'anonymous',
      status: 'denied',
      endpoint: sensitiveEndpoints[i % sensitiveEndpoints.length],
      method: 'GET',
      statusCode: 403,
      userAgent: 'Mozilla/5.0 (Nikto-v2.1.6 scanner)',
      rawPayload: { query: 'probing_sensitive_routes' }
    });
  }

  return logs;
}

async function sendLogs(logs) {
  try {
    const response = await axios.post(`${API_URL}/api/logs/ingest`, logs, {
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': SERVICE_KEY
      },
      timeout: 8000
    });
    console.log(`[Simulator] Successfully ingested ${logs.length} logs. Server response:`, response.data.message);
    return true;
  } catch (error) {
    if (error.response) {
      console.error(`[Simulator] Ingest failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`[Simulator] Network error connecting to ${API_URL}: ${error.message}`);
    }
    return false;
  }
}

async function runSimulation() {
  console.log(`\n======================================================`);
  console.log(`  NOTICIA SIEM LOG & ATTACK SCENARIO SIMULATOR       `);
  console.log(`  Target Ingest API: ${API_URL}/api/logs/ingest       `);
  console.log(`======================================================\n`);

  const now = new Date();
  const allLogs = [];

  // 1. Generate 25 normal baseline traffic records
  console.log('[Simulator] Generating baseline SOC background traffic...');
  for (let i = 0; i < 25; i++) {
    const time = new Date(now.getTime() - (30 - i) * 60 * 1000);
    allLogs.push(generateNormalLog(time));
  }

  // 2. Generate Brute-Force Attack Burst
  console.log(`[Simulator] Injecting BRUTE-FORCE attack burst from ${ATTACK_IPS.BRUTE_FORCE}...`);
  const bruteForceLogs = generateBruteForceBurst(16, now);
  allLogs.push(...bruteForceLogs);

  // 3. Generate Sensitive Endpoint Probe Burst
  console.log(`[Simulator] Injecting DIRECTORY TRAVERSAL / PROBE attack from ${ATTACK_IPS.PROBING}...`);
  const probeLogs = generateAdminProbeBurst(8, now);
  allLogs.push(...probeLogs);

  // 4. Send batch
  console.log(`[Simulator] Ingesting total batch of ${allLogs.length} simulated security events...`);
  const ok = await sendLogs(allLogs);

  if (ok) {
    console.log('\n[Simulator] Triggering ML anomaly detection run on backend...');
    try {
      // Trigger instant processing
      await axios.post(`${API_URL}/api/alerts/process`, {}, {
        headers: { 'x-service-key': SERVICE_KEY }
      });
      console.log('[Simulator] ML detection triggered successfully! Alerts should be visible on dashboard.');
    } catch (e) {
      console.log('[Simulator] (Cron will pick up logs automatically in 10s)');
    }
  }

  console.log('\n[Simulator] Simulation completed successfully!\n');
}

if (require.main === module) {
  runSimulation();
}

module.exports = {
  generateNormalLog,
  generateBruteForceBurst,
  generateAdminProbeBurst,
  runSimulation
};
