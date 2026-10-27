const axios = require('axios');
const { validateQuery } = require('./queryValidator');
const dbStore = require('./dbStore');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Llama 3.3 70B as requested in spec

/**
 * Call Groq API with prompt
 */
async function callGroqChat(messages, temperature = 0.1, jsonMode = false) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('your_')) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const payload = {
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: 1024
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await axios.post(GROQ_API_URL, payload, {
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  return response.data.choices[0].message.content.trim();
}

/**
 * Deterministic local query translator fallback when Groq key is absent
 */
function localQueryTranslatorFallback(question) {
  const q = question.toLowerCase();
  const query = {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check IP match (e.g., 192.168.1.1, 10.0.0.1, etc.)
  const ipMatch = question.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  if (ipMatch) {
    query.ip = ipMatch[0];
  }

  // Check username match (e.g. user admin, username root)
  const userMatch = question.match(/(?:user|username|account)\s+['"]?([a-zA-Z0-9_\-.]+)['"]?/i);
  if (userMatch) {
    query.username = userMatch[1];
  } else if (q.includes('admin user') || q.includes('user admin')) {
    query.username = 'admin';
  }

  // Check status (failed, success, denied)
  if (q.includes('fail') || q.includes('unsuccessful') || q.includes('brute') || q.includes('invalid password')) {
    query.status = 'failed';
  } else if (q.includes('denied') || q.includes('forbidden') || q.includes('blocked')) {
    query.status = 'denied';
  } else if (q.includes('success') || q.includes('successful') || q.includes('authorized')) {
    query.status = 'success';
  }

  // Check endpoints
  if (q.includes('admin endpoint') || q.includes('/admin')) {
    query.endpoint = { $regex: 'admin', $options: 'i' };
  } else if (q.includes('login') || q.includes('/auth') || q.includes('auth')) {
    query.endpoint = { $regex: 'login', $options: 'i' };
  }

  // Check time filters
  if (q.includes('today') || q.includes('recent') || q.includes('past 24')) {
    query.timestamp = { $gte: startOfToday.toISOString() };
  }

  return query;
}

/**
 * Deterministic local grounded summarizer fallback
 */
function localGroundedSummarizer(question, records) {
  const count = records.length;
  if (count === 0) {
    return `No matching security log events were found in the database for your query: "${question}".`;
  }

  const ips = [...new Set(records.map(r => r.ip))];
  const users = [...new Set(records.map(r => r.username || 'anonymous'))];
  const failedCount = records.filter(r => r.status === 'failed' || r.status === 'denied').length;
  const successCount = records.filter(r => r.status === 'success').length;

  let summary = `Retrieved ${count} matching log record(s) from the database. `;
  
  if (ips.length === 1) {
    summary += `All events originated from IP ${ips[0]}. `;
  } else if (ips.length <= 5) {
    summary += `Originating IP addresses: ${ips.join(', ')}. `;
  } else {
    summary += `Originating from ${ips.length} distinct IP addresses including ${ips.slice(0, 3).join(', ')}. `;
  }

  if (users.length === 1 && users[0] !== 'anonymous') {
    summary += `Targeted username: "${users[0]}". `;
  } else if (users.length > 1) {
    summary += `Targeted usernames: ${users.slice(0, 4).join(', ')}. `;
  }

  summary += `Event breakdown: ${failedCount} failed/denied attempt(s) and ${successCount} successful event(s). `;

  if (failedCount > 5) {
    summary += `Notice: High frequency of failed login attempts detected, characteristic of automated credential attacks or brute-force behavior.`;
  }

  return summary;
}

/**
 * Execute Two-Stage RAG Pipeline
 */
async function executeRAGQuery(question) {
  console.log(`[RAG Pipeline] Processing natural language query: "${question}"`);

  let generatedQuery = null;
  let usedFallbackTranslator = false;

  // --- STAGE 1: Natural Language -> MongoDB Filter Query ---
  try {
    const stage1SystemPrompt = `You are a strict security database query translator for Noticia SIEM.
Convert the user's natural language question into a valid MongoDB filter JSON object for the 'logs' collection.

Available Schema Fields (ONLY USE THESE):
- ip (string, e.g. "192.168.1.100")
- username (string, e.g. "admin")
- status (enum: "success", "failed", "denied")
- endpoint (string, e.g. "/api/auth/login")
- timestamp (ISODate with $gte, $lte operators)
- statusCode (number, e.g. 200, 401, 500)
- method (string, e.g. "POST", "GET")

CRITICAL INSTRUCTIONS:
1. Return ONLY a single valid JSON object. No explanation, no markdown ticks, no preamble.
2. Current UTC timestamp is: ${new Date().toISOString()}.
3. If user says 'today', use timestamp $gte set to the start of today (${new Date(new Date().setHours(0,0,0,0)).toISOString()}).
4. If the query cannot be translated, output {}.`;

    const rawResponse = await callGroqChat([
      { role: 'system', content: stage1SystemPrompt },
      { role: 'user', content: question }
    ], 0.1, true);

    generatedQuery = JSON.parse(rawResponse);
    console.log('[RAG Pipeline] Groq LLM generated query:', JSON.stringify(generatedQuery));
  } catch (error) {
    console.warn(`[RAG Pipeline] Groq Stage 1 translation error (${error.message}). Using local query parser fallback.`);
    generatedQuery = localQueryTranslatorFallback(question);
    usedFallbackTranslator = true;
    console.log('[RAG Pipeline] Fallback generated query:', JSON.stringify(generatedQuery));
  }

  // --- STAGE 2: Query Validation (Safety Gate) ---
  const validation = validateQuery(generatedQuery);
  if (!validation.isValid) {
    console.warn(`[RAG Pipeline] Query rejected by validator: ${validation.reason}`);
    return {
      success: false,
      question,
      generatedQuery,
      resultCount: 0,
      answer: `Query could not be executed: ${validation.reason}. Please rephrase your security inquiry.`,
      records: []
    };
  }

  const sanitizedQuery = validation.sanitizedQuery;

  // --- STAGE 3: Database Retrieval ---
  console.log('[RAG Pipeline] Executing validated query against MongoDB logs:', JSON.stringify(sanitizedQuery));
  const retrievedLogs = await dbStore.logs.find(sanitizedQuery)
    .sort({ timestamp: -1 })
    .limit(30);

  const resultCount = retrievedLogs.length;
  console.log(`[RAG Pipeline] Retrieved ${resultCount} matching log record(s) from database.`);

  // --- STAGE 4: Grounded Answer Generation ---
  let answer = '';
  try {
    const compactLogs = retrievedLogs.map(l => ({
      ip: l.ip,
      user: l.username,
      status: l.status,
      endpoint: l.endpoint,
      method: l.method,
      code: l.statusCode,
      time: l.timestamp
    }));

    const stage2SystemPrompt = `You are Noticia SIEM's grounded security analyst.
You must summarize ONLY the security log data provided below in concise, professional plain English for a SOC analyst.

CRITICAL RULES:
1. Summarize ONLY the data provided below.
2. If the data array is empty, say no matching records were found.
3. Do NOT add outside assumptions or information not present in the data.
4. Highlight notable patterns such as repeat offending IPs, burst failures, and target endpoints.`;

    const userMessageContent = `User Question: "${question}"
Retrieved Log Records (${compactLogs.length} matches):
${JSON.stringify(compactLogs, null, 2)}`;

    answer = await callGroqChat([
      { role: 'system', content: stage2SystemPrompt },
      { role: 'user', content: userMessageContent }
    ], 0.2, false);
  } catch (error) {
    console.warn(`[RAG Pipeline] Groq Stage 2 summarization error (${error.message}). Using local grounded summarizer.`);
    answer = localGroundedSummarizer(question, retrievedLogs);
  }

  return {
    success: true,
    question,
    generatedQuery: sanitizedQuery,
    resultCount,
    answer,
    records: retrievedLogs.slice(0, 10)
  };
}

module.exports = {
  executeRAGQuery
};
