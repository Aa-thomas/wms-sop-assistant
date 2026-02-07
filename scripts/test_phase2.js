require('dotenv').config();
const { spawn } = require('child_process');
const http = require('http');
const { Pool } = require('pg');

const PORT = 3001; // Use different port to avoid conflicts
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function waitForServer(maxWait = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      request('GET', '/health')
        .then(r => { if (r.status === 200) resolve(); else setTimeout(check, 500); })
        .catch(() => {
          if (Date.now() - start > maxWait) reject(new Error('Server did not start'));
          else setTimeout(check, 500);
        });
    };
    check();
  });
}

async function test21_health() {
  console.log('\n--- Test 2.1: Health endpoint ---');
  const r = await request('GET', '/health');
  assert(r.status === 200, `GET /health returns 200 (got ${r.status})`);
  assert(r.body.status === 'ok', 'response has status: ok');
}

async function test22_validQuestion() {
  console.log('\n--- Test 2.2: Valid question returns grounded answer ---');
  const start = Date.now();
  const r = await request('POST', '/ask', { question: 'How do I receive an inbound order?' });
  const elapsed = Date.now() - start;

  assert(r.status === 200, `status 200 (got ${r.status})`);
  assert(Array.isArray(r.body.answer), 'response has answer array');
  assert(r.body.answer.length >= 1, `at least 1 answer item (got ${r.body.answer.length})`);

  if (r.body.answer.length > 0) {
    const first = r.body.answer[0];
    assert(typeof first.claim === 'string' && first.claim.length > 0, 'first item has non-empty claim');
    assert(Array.isArray(first.citations), 'first item has citations array');

    if (first.citations.length > 0) {
      const cit = first.citations[0];
      assert(cit.doc_title, 'citation has doc_title');
      assert(cit.source_locator, 'citation has source_locator');
      assert(typeof cit.slide_number === 'number', 'citation has numeric slide_number');
    }
  }

  assert('follow_up_question' in r.body, 'response has follow_up_question field');
  assert(elapsed < 15000, `response time ${elapsed}ms (< 15s)`);

  console.log('  Response preview:', JSON.stringify(r.body.answer[0], null, 2).substring(0, 200));
}

async function test23_moduleFilter() {
  console.log('\n--- Test 2.3: Module filter works ---');
  const r1 = await request('POST', '/ask', { question: 'How do I receive an inbound order?', module: 'Inbound' });
  assert(r1.status === 200, 'Inbound filter: status 200');
  assert(Array.isArray(r1.body.answer), 'Inbound filter: has answer array');

  const r2 = await request('POST', '/ask', { question: 'How do I receive an inbound order?', module: 'Picking' });
  assert(r2.status === 200, 'Picking filter: status 200');
  assert(r2.body.answer !== undefined, 'Picking filter: has answer field (may be string "Not found" or array)');
}

async function test24_outOfScope() {
  console.log('\n--- Test 2.4: Out-of-scope question ---');
  const r = await request('POST', '/ask', { question: 'What is the weather today?' });
  assert(r.status === 200, `status 200 (got ${r.status})`);

  const answerText = r.body.answer.map(a => a.claim).join(' ').toLowerCase();
  const hasNotFound = answerText.includes('not found') || answerText.includes('not in the sops') || answerText.includes('not available');
  const hasFollowUp = r.body.follow_up_question !== null && r.body.follow_up_question !== undefined;
  assert(hasNotFound || hasFollowUp, 'triggers safe failure (not found or follow-up question)');
  console.log('  Response:', r.body.answer[0]?.claim?.substring(0, 150));
  if (r.body.follow_up_question) console.log('  Follow-up:', r.body.follow_up_question);
}

async function test25_inputValidation() {
  console.log('\n--- Test 2.5: Input validation ---');
  const r1 = await request('POST', '/ask', {});
  assert(r1.status === 400, `missing question: 400 (got ${r1.status})`);

  const r2 = await request('POST', '/ask', { question: '' });
  assert(r2.status === 400, `empty question: 400 (got ${r2.status})`);

  const r3 = await request('POST', '/ask', { question: 'a'.repeat(501) });
  assert(r3.status === 400, `too long question: 400 (got ${r3.status})`);
}

async function test26_feedback() {
  console.log('\n--- Test 2.6: Feedback endpoint ---');
  const r = await request('POST', '/feedback', {
    question: 'test question',
    response_id: 'test_phase2_123',
    helpful: true
  });
  assert(r.status === 200, `feedback stored: 200 (got ${r.status})`);

  // Verify in DB
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const result = await pool.query("SELECT * FROM feedback WHERE response_id = 'test_phase2_123'");
  assert(result.rows.length > 0, 'feedback row exists in DB');

  // Clean up
  await pool.query("DELETE FROM feedback WHERE response_id = 'test_phase2_123'");
  await pool.end();
}

async function main() {
  // Start server
  console.log('Starting server on port', PORT, '...');
  const server = spawn('node', ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', d => process.stdout.write(`  [server] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`  [server err] ${d}`));

  try {
    await waitForServer();
    console.log('Server ready.\n');

    await test21_health();
    await test22_validQuestion();
    await test23_moduleFilter();
    await test24_outOfScope();
    await test25_inputValidation();
    await test26_feedback();

    console.log(`\n========================================`);
    console.log(`Phase 2 Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);
  } finally {
    server.kill();
    if (failed > 0) process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
