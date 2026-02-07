#!/usr/bin/env node

/**
 * Onboarding Module Verification Test
 * Tests all 9 WMS modules end-to-end: available → start → step → complete-step → progress
 * Requires backend running on localhost:3000 with Postgres available.
 */

const BASE = 'http://localhost:3000';

const EXPECTED_MODULES = [
  'Admin', 'CycleCounts', 'Inbound', 'Inventory',
  'Navigation', 'Outbound', 'Picking', 'Replenishment', 'Returns'
];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${message}`);
    failed++;
  }
}

async function api(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(`${BASE}${path}`, options);
  const data = await resp.json();
  return { status: resp.status, body: data };
}

async function cleanup(userIds) {
  console.log('\n--- Cleanup ---');
  try {
    const { Pool } = require('pg');
    require('dotenv').config();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
    const progressResult = await pool.query(
      `DELETE FROM onboarding_progress WHERE user_id IN (${placeholders}) RETURNING user_id`,
      userIds
    );
    assert(true, `Cleaned up ${progressResult.rowCount} test progress rows`);

    const quizResult = await pool.query(
      `DELETE FROM onboarding_quiz_attempts WHERE user_id IN (${placeholders}) RETURNING user_id`,
      userIds
    );
    assert(true, `Cleaned up ${quizResult.rowCount} test quiz attempt rows`);

    await pool.end();
  } catch (err) {
    console.log(`  [WARN] Cleanup failed: ${err.message}`);
    console.log('  Manually run: DELETE FROM onboarding_progress WHERE user_id LIKE \'test_onboarding_%\';');
    console.log('  And: DELETE FROM onboarding_quiz_attempts WHERE user_id LIKE \'test_%\';');
  }
}

async function group1_available() {
  console.log('\n--- Group 1: Available modules ---');

  const r = await api('GET', '/onboarding/available');
  assert(r.status === 200, `GET /onboarding/available returns 200 (got ${r.status})`);
  assert(Array.isArray(r.body), 'Response is an array');
  assert(r.body.length === 9, `Returns exactly 9 modules (got ${r.body.length})`);

  const moduleNames = r.body.map(m => m.module).sort();
  assert(
    JSON.stringify(moduleNames) === JSON.stringify(EXPECTED_MODULES),
    `Module names match expected set`
  );

  for (const mod of r.body) {
    assert(parseInt(mod.total_steps) > 0, `${mod.module}: total_steps > 0 (got ${mod.total_steps})`);
    assert(mod.topics && mod.topics.length > 0, `${mod.module}: has non-empty topics`);
  }

  // Return module step counts for use in group 2
  const stepCounts = {};
  for (const mod of r.body) {
    stepCounts[mod.module] = parseInt(mod.total_steps);
  }
  return stepCounts;
}

async function group2_start_and_step(stepCounts) {
  console.log('\n--- Group 2: Start + Step for every module ---');

  const userIds = [];

  for (const module of EXPECTED_MODULES) {
    const userId = `test_onboarding_${module.toLowerCase()}`;
    userIds.push(userId);
    console.log(`\n  >> ${module} (${stepCounts[module]} steps)`);

    // Start onboarding
    const startR = await api('POST', '/onboarding/start', { user_id: userId, module });
    assert(startR.status === 200, `${module}: start returns 200 (got ${startR.status})`);
    assert(startR.body.status === 'started', `${module}: status is "started" (got "${startR.body.status}")`);

    if (startR.body.step) {
      assert(startR.body.step.step_number === 1, `${module}: step_number is 1 (got ${startR.body.step.step_number})`);
      assert(startR.body.step.step_title && startR.body.step.step_title.length > 0, `${module}: step_title non-empty`);
      assert(
        parseInt(startR.body.step.total_steps) === stepCounts[module],
        `${module}: total_steps matches available (${startR.body.step.total_steps} vs ${stepCounts[module]})`
      );
    } else {
      assert(false, `${module}: start response missing step object`);
      continue;
    }

    // Get step content (Claude call)
    const stepStart = Date.now();
    const stepR = await api('POST', '/onboarding/step', { user_id: userId, module });
    const stepElapsed = Date.now() - stepStart;

    assert(stepR.status === 200, `${module}: step returns 200 (got ${stepR.status})`);

    if (stepR.status !== 200) {
      console.log(`    Error: ${JSON.stringify(stepR.body)}`);
      continue;
    }

    // Validate explanation
    const explanation = stepR.body.explanation || '';
    assert(
      typeof explanation === 'string' && explanation.length > 50,
      `${module}: explanation length > 50 (got ${explanation.length} chars)`
    );

    // Validate citations
    const citations = stepR.body.citations || [];
    assert(Array.isArray(citations) && citations.length >= 1, `${module}: has >= 1 citation (got ${citations.length})`);

    for (const cit of citations) {
      assert(typeof cit.doc_title === 'string' && cit.doc_title.length > 0, `${module}: citation has doc_title`);
      assert(
        typeof cit.source_locator === 'string' && cit.source_locator.length > 0,
        `${module}: citation has non-empty source_locator (got "${cit.source_locator}")`
      );
      assert(typeof cit.slide_number === 'number', `${module}: citation has numeric slide_number`);
    }

    // Validate checkpoint
    const checkpoint = stepR.body.checkpoint || '';
    assert(checkpoint.length > 0, `${module}: checkpoint is non-empty`);
    assert(checkpoint.endsWith('?'), `${module}: checkpoint ends with "?" (got "${checkpoint.slice(-10)}")`);

    // Validate step numbers
    assert(stepR.body.step_number === 1, `${module}: step response has step_number 1`);
    assert(parseInt(stepR.body.total_steps) === stepCounts[module], `${module}: step response total_steps matches`);

    // Validate response time
    assert(stepElapsed < 30000, `${module}: response time ${(stepElapsed / 1000).toFixed(1)}s (< 30s)`);

    console.log(`    ${explanation.length} chars, ${citations.length} citations, ${(stepElapsed / 1000).toFixed(1)}s`);
  }

  return userIds;
}

async function group3_progression(userIds) {
  console.log('\n--- Group 3: Complete-step flow (Picking) ---');

  const userId = 'test_onboarding_picking';
  const module = 'Picking';

  // Complete step 1
  const completeR = await api('POST', '/onboarding/complete-step', {
    user_id: userId, module, step_number: 1
  });
  assert(completeR.status === 200, `complete-step returns 200 (got ${completeR.status})`);
  assert(completeR.body.completed === false, `completed is false (got ${completeR.body.completed})`);
  assert(
    completeR.body.next_step && completeR.body.next_step.step_number === 2,
    `next_step.step_number is 2 (got ${completeR.body.next_step?.step_number})`
  );

  // Check progress
  const progressR = await api('GET', `/onboarding/progress/${userId}`);
  assert(progressR.status === 200, `progress returns 200 (got ${progressR.status})`);
  assert(Array.isArray(progressR.body) && progressR.body.length > 0, 'progress returns non-empty array');

  if (progressR.body.length > 0) {
    const pickingProgress = progressR.body.find(p => p.module === 'Picking');
    assert(pickingProgress !== undefined, 'progress includes Picking module');
    if (pickingProgress) {
      assert(
        parseInt(pickingProgress.completed_count) === 1,
        `completed_count is 1 (got ${pickingProgress.completed_count})`
      );
      assert(
        parseInt(pickingProgress.current_step) === 2,
        `current_step is 2 (got ${pickingProgress.current_step})`
      );
    }
  }
}

async function group5_quiz_validation() {
  console.log('\n--- Group 5: Quiz Validation ---');

  const userId = 'test_quiz_validation';
  const module = 'Picking';

  // Start onboarding first so user exists
  await api('POST', '/onboarding/start', { user_id: userId, module });

  // Submit a reasonable answer (should be correct or at least get a response)
  const correctStart = Date.now();
  const correctR = await api('POST', '/onboarding/validate-answer', {
    user_id: userId,
    module,
    step_number: 1,
    user_answer: 'You navigate to the picking screen from the main WMS menu using the menu bar or hot keys'
  });
  const correctElapsed = Date.now() - correctStart;

  assert(correctR.status === 200, `validate-answer returns 200 (got ${correctR.status})`);
  assert(typeof correctR.body.is_correct === 'boolean', `is_correct is boolean (got ${typeof correctR.body.is_correct})`);
  assert(typeof correctR.body.feedback === 'string' && correctR.body.feedback.length > 0, `feedback is non-empty string`);
  assert(correctR.body.attempts === 1, `attempts is 1 (got ${correctR.body.attempts})`);
  assert(correctR.body.max_attempts === 3, `max_attempts is 3 (got ${correctR.body.max_attempts})`);
  assert(correctElapsed < 30000, `response time ${(correctElapsed / 1000).toFixed(1)}s (< 30s)`);

  console.log(`    Attempt 1: is_correct=${correctR.body.is_correct}, ${(correctElapsed / 1000).toFixed(1)}s`);

  // Submit a clearly wrong answer
  const wrongR = await api('POST', '/onboarding/validate-answer', {
    user_id: userId,
    module,
    step_number: 1,
    user_answer: 'I have no idea'
  });

  assert(wrongR.status === 200, `wrong answer returns 200 (got ${wrongR.status})`);
  assert(wrongR.body.is_correct === false, `wrong answer is_correct is false (got ${wrongR.body.is_correct})`);
  assert(typeof wrongR.body.feedback === 'string' && wrongR.body.feedback.length > 0, `wrong answer has feedback`);
  assert(wrongR.body.attempts === 2, `attempts is 2 (got ${wrongR.body.attempts})`);
  assert(wrongR.body.can_proceed === false, `can_proceed is false on attempt 2 (got ${wrongR.body.can_proceed})`);

  console.log(`    Attempt 2: is_correct=${wrongR.body.is_correct}`);

  // Submit 3rd wrong answer - should allow proceed
  const thirdR = await api('POST', '/onboarding/validate-answer', {
    user_id: userId,
    module,
    step_number: 1,
    user_answer: 'Still no idea'
  });

  assert(thirdR.status === 200, `3rd attempt returns 200 (got ${thirdR.status})`);
  assert(thirdR.body.attempts === 3, `attempts is 3 (got ${thirdR.body.attempts})`);
  assert(thirdR.body.can_proceed === true, `can_proceed is true on attempt 3 (got ${thirdR.body.can_proceed})`);

  console.log(`    Attempt 3: can_proceed=${thirdR.body.can_proceed}`);

  // Validate missing fields returns 400
  const badR = await api('POST', '/onboarding/validate-answer', {
    user_id: userId,
    module
  });
  assert(badR.status === 400, `missing fields returns 400 (got ${badR.status})`);

  return userId;
}

async function group6_supervisor_dashboard() {
  console.log('\n--- Group 6: Supervisor Dashboard ---');

  // GET /supervisor/dashboard
  const dashR = await api('GET', '/onboarding/supervisor/dashboard');
  assert(dashR.status === 200, `GET /supervisor/dashboard returns 200 (got ${dashR.status})`);
  assert(Array.isArray(dashR.body), 'dashboard returns array');

  if (dashR.body.length > 0) {
    const first = dashR.body[0];
    assert('user_id' in first, 'dashboard row has user_id');
    assert('module' in first, 'dashboard row has module');
    assert('status' in first, 'dashboard row has status');
    assert('completion_percentage' in first, 'dashboard row has completion_percentage');
    assert('steps_completed' in first, 'dashboard row has steps_completed');
    assert('total_steps' in first, 'dashboard row has total_steps');
    console.log(`    Dashboard has ${dashR.body.length} rows`);
  }

  // GET /supervisor/summary
  const summaryR = await api('GET', '/onboarding/supervisor/summary');
  assert(summaryR.status === 200, `GET /supervisor/summary returns 200 (got ${summaryR.status})`);
  assert(Array.isArray(summaryR.body), 'summary returns array');

  if (summaryR.body.length > 0) {
    const first = summaryR.body[0];
    assert('module' in first, 'summary row has module');
    assert('total_users' in first, 'summary row has total_users');
    assert('completed_users' in first, 'summary row has completed_users');
    assert('in_progress_users' in first, 'summary row has in_progress_users');
    console.log(`    Summary has ${summaryR.body.length} module rows`);
  }

  // GET /supervisor/summary with module filter
  const filteredR = await api('GET', '/onboarding/supervisor/summary?module=Picking');
  assert(filteredR.status === 200, `filtered summary returns 200 (got ${filteredR.status})`);
  if (filteredR.body.length > 0) {
    assert(filteredR.body[0].module === 'Picking', `filtered summary shows Picking (got ${filteredR.body[0].module})`);
  }

  // GET /supervisor/user/:user_id
  const userR = await api('GET', '/onboarding/supervisor/user/test_onboarding_picking');
  assert(userR.status === 200, `GET /supervisor/user returns 200 (got ${userR.status})`);
  assert(Array.isArray(userR.body), 'user details returns array');

  if (userR.body.length > 0) {
    const first = userR.body[0];
    assert('module' in first, 'user detail has module');
    assert('completed_count' in first, 'user detail has completed_count');
    assert('total_steps' in first, 'user detail has total_steps');
    console.log(`    User details has ${userR.body.length} module rows`);
  }
}

async function main() {
  console.log('=== Onboarding Module Verification (v1 + v2) ===');

  // Health check
  try {
    const health = await api('GET', '/health');
    if (health.status !== 200) {
      console.error('Server not healthy. Start the backend first: npm run dev');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Cannot reach server at ${BASE}. Start the backend first: npm run dev`);
    process.exit(1);
  }
  console.log('Server is healthy.');

  let userIds = [];

  try {
    // v1 tests
    const stepCounts = await group1_available();
    userIds = await group2_start_and_step(stepCounts);
    await group3_progression(userIds);

    // v2 tests
    const quizUserId = await group5_quiz_validation();
    userIds.push(quizUserId);
    await group6_supervisor_dashboard();
  } finally {
    await cleanup(userIds);
  }

  console.log(`\n========================================`);
  console.log(`Results: ${passed}/${passed + failed} passed, ${failed} failed`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
