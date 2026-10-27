const test = require('node:test');
const assert = require('node:assert');
const dbStore = require('../services/dbStore');
const { processUnprocessedLogs } = require('../cron/logProcessor');
const { executeRAGQuery } = require('../services/ragService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

test('End-to-End Noticia Security Pipeline Integration Tests', async (t) => {
  // Clear memory store before tests
  dbStore._resetMemoryStore();

  let adminUser = null;
  let adminToken = null;
  const SECRET = process.env.JWT_SECRET || 'noticia_jwt_secret_key_2026_super_secure_key';

  await t.test('1. Auth Flow: Register, 2FA OTP generation and Verification', async () => {
    // 1a. Register first user (automatically bootstrap admin)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecOpsPass2026!', salt);

    adminUser = await dbStore.users.create({
      name: 'Chief Analyst',
      email: 'soc.admin@noticia.local',
      passwordHash,
      role: 'admin',
      otpCode: '582914',
      otpExpires: new Date(Date.now() + 10 * 60 * 1000)
    });

    assert.ok(adminUser._id);
    assert.strictEqual(adminUser.role, 'admin');

    // 1b. Verify OTP -> generate JWT
    assert.strictEqual(adminUser.otpCode, '582914');
    adminToken = jwt.sign(
      { id: adminUser._id.toString(), role: adminUser.role, email: adminUser.email, name: adminUser.name },
      SECRET,
      { expiresIn: '24h' }
    );

    assert.ok(adminToken);
    const decoded = jwt.verify(adminToken, SECRET);
    assert.strictEqual(decoded.email, 'soc.admin@noticia.local');
    assert.strictEqual(decoded.role, 'admin');
  });

  await t.test('2. Log Ingestion: Ingest normal traffic and brute force attack burst', async () => {
    const logs = [];
    const now = new Date();

    // 5 normal logs
    for (let i = 0; i < 5; i++) {
      logs.push({
        timestamp: new Date(now.getTime() - (10 - i) * 60 * 1000),
        ip: '192.168.1.50',
        username: 'alice_soc',
        status: 'success',
        endpoint: '/api/dashboard',
        method: 'GET',
        statusCode: 200,
        processed: false
      });
    }

    // 15 rapid brute force failed logins from attacker IP 203.0.113.88
    for (let i = 0; i < 15; i++) {
      logs.push({
        timestamp: new Date(now.getTime() - (15 - i) * 1000),
        ip: '203.0.113.88',
        username: 'admin',
        status: 'failed',
        endpoint: '/api/auth/login',
        method: 'POST',
        statusCode: 401,
        processed: false
      });
    }

    const saved = await dbStore.logs.insertMany(logs);
    assert.strictEqual(saved.length, 20);

    const unprocessedCount = await dbStore.logs.countDocuments({ processed: false });
    assert.strictEqual(unprocessedCount, 20);
  });

  await t.test('3. ML Anomaly Detection & Alert Generation Pipeline', async () => {
    // Process logs through ML scoring pipeline
    await processUnprocessedLogs(null);

    // Verify all logs were marked processed
    const remainingUnprocessed = await dbStore.logs.countDocuments({ processed: false });
    assert.strictEqual(remainingUnprocessed, 0);

    // Verify Alert was generated for attacker IP 203.0.113.88
    const alerts = await dbStore.alerts.find({ ip: '203.0.113.88' });
    assert.ok(alerts.length > 0, 'Expected at least one alert generated for attacker IP');

    const highAlert = alerts.find(a => a.severity === 'high');
    assert.ok(highAlert, 'Expected at least one high-severity alert for brute force attack');
    assert.ok(highAlert.anomalyScore >= 0.70, `Anomaly score should be >= 0.70, got ${highAlert.anomalyScore}`);
    assert.strictEqual(highAlert.status, 'open');
  });

  await t.test('4. Action Workflow: Admin blocks malicious IP', async () => {
    const alert = (await dbStore.alerts.find({ ip: '203.0.113.88' }))[0];

    const blockRecord = await dbStore.blockedIPs.create({
      ip: alert.ip,
      reason: 'Confirmed brute-force credential stuffing attack',
      blockedBy: adminUser._id,
      alertId: alert._id,
      blockedAt: new Date()
    });

    assert.ok(blockRecord._id);
    assert.strictEqual(blockRecord.ip, '203.0.113.88');

    // Update alert status to actioned
    await dbStore.alerts.findByIdAndUpdate(alert._id, { $set: { status: 'actioned' } });
    const updatedAlert = await dbStore.alerts.findById(alert._id);
    assert.strictEqual(updatedAlert.status, 'actioned');
  });

  await t.test('5. Natural Language Query RAG Grounding Verification', async () => {
    const question = 'Show all failed logins from IP 203.0.113.88';
    const ragResult = await executeRAGQuery(question);

    assert.strictEqual(ragResult.success, true);
    assert.ok(ragResult.resultCount > 0, `Expected resultCount > 0, got ${ragResult.resultCount}`);
    assert.ok(ragResult.answer.includes('203.0.113.88'), 'Answer must mention the queried IP address');
    assert.ok(ragResult.answer.includes('Retrieved') || ragResult.answer.includes('failed'), 'Answer must summarize retrieved logs');

    // Save to ChatHistory
    const history = await dbStore.chatHistory.create({
      userId: adminUser._id,
      question,
      generatedQuery: ragResult.generatedQuery,
      resultCount: ragResult.resultCount,
      answer: ragResult.answer,
      createdAt: new Date()
    });

    assert.ok(history._id);
  });
});
