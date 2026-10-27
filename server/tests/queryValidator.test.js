const test = require('node:test');
const assert = require('node:assert');
const { validateQuery } = require('../services/queryValidator');

test('QueryValidator Unit Tests', async (t) => {
  await t.test('Accepts valid query with allowed fields and operators', () => {
    const validQuery = {
      ip: '192.168.1.100',
      status: 'failed',
      endpoint: { $regex: 'login', $options: 'i' },
      timestamp: { $gte: '2026-10-27T00:00:00.000Z' }
    };

    const res = validateQuery(validQuery);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.sanitizedQuery.ip, '192.168.1.100');
    assert.strictEqual(res.sanitizedQuery.status, 'failed');
    assert.ok(res.sanitizedQuery.timestamp.$gte instanceof Date);
  });

  await t.test('Rejects disallowed field names', () => {
    const maliciousQuery = {
      ip: '10.0.0.1',
      credit_card_number: '1234-5678-9012' // Disallowed field!
    };

    const res = validateQuery(maliciousQuery);
    assert.strictEqual(res.isValid, false);
    assert.match(res.reason, /Disallowed field "credit_card_number"/);
  });

  await t.test('Rejects dangerous injection operators ($where, $accumulator, eval)', () => {
    const injectionQuery1 = {
      $where: 'sleep(5000)'
    };
    const res1 = validateQuery(injectionQuery1);
    assert.strictEqual(res1.isValid, false);
    assert.match(res1.reason, /Forbidden operator/);

    const injectionQuery2 = {
      ip: { $function: { body: 'function() { return true; }', args: [], lang: 'js' } }
    };
    const res2 = validateQuery(injectionQuery2);
    assert.strictEqual(res2.isValid, false);
    assert.match(res2.reason, /Forbidden operator/);
  });

  await t.test('Rejects malformed or absurd dates (year 1900)', () => {
    const absurdDateQuery = {
      timestamp: { $gte: '1900-01-01T00:00:00.000Z' }
    };
    const res = validateQuery(absurdDateQuery);
    assert.strictEqual(res.isValid, false);
    assert.match(res.reason, /absurd date/);

    const gibberishDateQuery = {
      timestamp: { $gte: 'not-a-real-date' }
    };
    const resGibberish = validateQuery(gibberishDateQuery);
    assert.strictEqual(resGibberish.isValid, false);
    assert.match(resGibberish.reason, /absurd date/);
  });

  await t.test('Handles valid logical $or and $and operators', () => {
    const complexQuery = {
      $or: [
        { status: 'failed' },
        { status: 'denied' }
      ]
    };
    const res = validateQuery(complexQuery);
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.sanitizedQuery.$or.length, 2);
  });
});
