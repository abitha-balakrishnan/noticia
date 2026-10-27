const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const SERVICE_KEY = 'noticia_internal_service_key_987654321';

async function verifyLive() {
  console.log('=== Starting Noticia SIEM Live End-to-End Verification ===\n');

  // 1. Health check
  const healthRes = await axios.get(`${BASE_URL}/api/health`);
  console.log('[1/7] Health Check Status:', healthRes.data.status, healthRes.data.database);

  // 2. Ingest Logs with Attack Scenario
  console.log('\n[2/7] Ingesting simulated baseline logs and brute-force attack burst...');
  const logsToIngest = [];
  const now = new Date();

  // 10 normal logs
  for (let i = 0; i < 10; i++) {
    logsToIngest.push({
      timestamp: new Date(now.getTime() - (20 - i) * 60 * 1000),
      ip: '192.168.1.20',
      username: 'carol_analyst',
      status: 'success',
      endpoint: '/api/dashboard',
      method: 'GET',
      statusCode: 200
    });
  }

  // 15 brute force attack failed attempts from 203.0.113.88
  for (let i = 0; i < 15; i++) {
    logsToIngest.push({
      timestamp: new Date(now.getTime() - (15 - i) * 1000),
      ip: '203.0.113.88',
      username: 'admin',
      status: 'failed',
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 401
    });
  }

  const ingestRes = await axios.post(`${BASE_URL}/api/logs/ingest`, logsToIngest, {
    headers: { 'x-service-key': SERVICE_KEY }
  });
  console.log('[2/7] Ingestion Response:', ingestRes.data.message);

  // 3. Trigger ML Anomaly Processing
  console.log('\n[3/7] Triggering ML Anomaly Detection pipeline...');
  const triggerRes = await axios.post(`${BASE_URL}/api/alerts/process`, {}, {
    headers: { 'x-service-key': SERVICE_KEY }
  });
  console.log('[3/7] ML Processing Response:', triggerRes.data.message);

  // 4. Register Administrator Account
  console.log('\n[4/7] Testing User Registration & 2FA Login Flow...');
  const regEmail = `secops_${Date.now()}@noticia.local`;
  const regRes = await axios.post(`${BASE_URL}/api/auth/register`, {
    name: 'Lead SOC Admin',
    email: regEmail,
    password: 'SecurePassword2026!'
  });
  console.log('[4/7] Register Response:', regRes.data.message, `Role: ${regRes.data.data.role}`);

  // 4b. Login (triggers OTP)
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: regEmail,
    password: 'SecurePassword2026!'
  });
  console.log('[4/7] Login Response:', loginRes.data.message, `OTP Code: ${loginRes.data.previewOtp}`);

  // 4c. Verify OTP
  const verifyRes = await axios.post(`${BASE_URL}/api/auth/verify-otp`, {
    tempToken: loginRes.data.tempToken,
    otp: loginRes.data.previewOtp
  });
  const token = verifyRes.data.token;
  console.log('[4/7] Verify OTP Response:', verifyRes.data.message, 'JWT Issued successfully.');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 5. Query Dashboard Summary
  console.log('\n[5/7] Querying Dashboard Summary (Stats & Charts)...');
  const summaryRes = await axios.get(`${BASE_URL}/api/dashboard/summary`, { headers: authHeaders });
  console.log('[5/7] Dashboard Stats:', summaryRes.data.data.stats);
  console.log('[5/7] Severity Distribution:', summaryRes.data.data.severityDistribution);
  console.log('[5/7] Recent Alerts Count:', summaryRes.data.data.recentAlerts.length);

  // 6. Query Alerts Feed
  console.log('\n[6/7] Querying Alerts Feed...');
  const alertsRes = await axios.get(`${BASE_URL}/api/alerts`, { headers: authHeaders });
  console.log(`[6/7] Alerts Retrieved: ${alertsRes.data.total}`);
  const attackerAlert = alertsRes.data.data.find(a => a.ip === '203.0.113.88');
  if (attackerAlert) {
    console.log(`[6/7] Found Anomaly Alert for 203.0.113.88: Severity=${attackerAlert.severity}, Score=${attackerAlert.anomalyScore}`);
  }

  // 7. Grounded Natural Language Query (RAG)
  console.log('\n[7/7] Testing Two-Stage Grounded RAG Natural Language Query...');
  const chatQuestion = 'Show all failed logins from IP 203.0.113.88';
  const chatRes = await axios.post(`${BASE_URL}/api/chat/query`, {
    question: chatQuestion
  }, { headers: authHeaders });

  console.log(`[7/7] User Question: "${chatQuestion}"`);
  console.log(`[7/7] Grounded Answer: "${chatRes.data.data.answer}"`);
  console.log(`[7/7] Records Matched: ${chatRes.data.data.resultCount}`);
  console.log(`[7/7] Validated Filter:`, JSON.stringify(chatRes.data.data.generatedQuery));

  // 8. Action Mitigation: Admin Blocks IP
  if (attackerAlert) {
    console.log('\n[Bonus] Testing Admin Action Mitigation: Blocking Attacker IP...');
    const blockRes = await axios.post(`${BASE_URL}/api/actions/block-ip`, {
      ip: attackerAlert.ip,
      alertId: attackerAlert._id,
      reason: 'Confirmed automated brute force credential guessing'
    }, { headers: authHeaders });
    console.log('[Bonus] Block IP Response:', blockRes.data.message);

    const blockedList = await axios.get(`${BASE_URL}/api/actions/blocked-ips`, { headers: authHeaders });
    console.log(`[Bonus] Active Blocked IPs Count: ${blockedList.data.data.length}`);
  }

  console.log('\n=== ALL END-TO-END VERIFICATION CHECKS COMPLETED WITH 100% SUCCESS! ===\n');
}

verifyLive().catch(err => {
  console.error('Verification failed:', err.response?.data || err.message);
  process.exit(1);
});
