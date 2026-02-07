import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { testUserId, cleanupTestData, cleanupAllTestData, closePool } = require('../helpers/db-setup');
const { makeOnboardingResponse, makeQuizValidationResponse } = require('../helpers/mocks');

/*
 * Integration tests for onboarding routes.
 * Uses a real Postgres database (requires DB running with curriculum seeded).
 * Mocks external APIs (OpenAI embeddings + Claude generation) via require.cache injection.
 */

// ── Mock setup via require.cache ────────────────────────────────────────────
// CJS modules loaded via require() won't be intercepted by vi.mock.
// Instead, we inject mock modules directly into Node's require cache
// BEFORE loading server/app.js, so all downstream requires get our mocks.

const mockGenerate = vi.fn();
const mockRetrieve = vi.fn().mockResolvedValue([
  {
    id: 'Test_SOP_slide_1',
    text: 'Step 1: Log in to the WMS portal. Step 2: Navigate to the main menu.',
    doc_title: 'Test SOP',
    source_locator: 'Test SOP - Slide 1',
    slide_number: 1,
    module: 'Navigation',
    similarity: 0.85,
  },
]);

// Resolve absolute paths to the modules we want to mock
const generatePath = require.resolve('../../server/lib/generate');
const retrievalPath = require.resolve('../../server/lib/retrieval');

// Clear any previously cached versions
delete require.cache[generatePath];
delete require.cache[retrievalPath];

// Inject mocks into require.cache
require.cache[generatePath] = {
  id: generatePath,
  filename: generatePath,
  loaded: true,
  exports: { generate: mockGenerate },
};

require.cache[retrievalPath] = {
  id: retrievalPath,
  filename: retrievalPath,
  loaded: true,
  exports: { retrieve: mockRetrieve },
};

// Now clear any cached app/routes so they pick up our mocks
const appPath = require.resolve('../../server/app');
const onboardingRoutePath = require.resolve('../../server/routes/onboarding');
delete require.cache[appPath];
delete require.cache[onboardingRoutePath];

// Load app — it will require generate/retrieval from cache and get our mocks
const app = require('../../server/app');
const request = require('supertest');

let testUsers = [];

beforeAll(async () => {
  await cleanupAllTestData();
});

afterAll(async () => {
  await cleanupTestData(testUsers);
  await closePool();
});

beforeEach(() => {
  mockGenerate.mockReset();
  mockRetrieve.mockClear();
  // Re-apply default retrieve mock
  mockRetrieve.mockResolvedValue([
    {
      id: 'Test_SOP_slide_1',
      text: 'Step 1: Log in to the WMS portal. Step 2: Navigate to the main menu.',
      doc_title: 'Test SOP',
      source_locator: 'Test SOP - Slide 1',
      slide_number: 1,
      module: 'Navigation',
      similarity: 0.85,
    },
  ]);
});

describe('GET /onboarding/available', () => {
  it('returns all 9 modules', async () => {
    const res = await request(app).get('/onboarding/available');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(9);

    const names = res.body.map(m => m.module).sort();
    expect(names).toEqual([
      'Admin', 'CycleCounts', 'Inbound', 'Inventory',
      'Navigation', 'Outbound', 'Picking', 'Replenishment', 'Returns',
    ]);
  });

  it('each module has total_steps > 0 and topics', async () => {
    const res = await request(app).get('/onboarding/available');

    for (const mod of res.body) {
      expect(parseInt(mod.total_steps)).toBeGreaterThan(0);
      expect(mod.topics.length).toBeGreaterThan(0);
    }
  });

  it('step counts match expected values', async () => {
    const res = await request(app).get('/onboarding/available');
    const counts = {};
    for (const m of res.body) counts[m.module] = parseInt(m.total_steps);

    expect(counts.Navigation).toBe(4);
    expect(counts.Picking).toBe(5);
    expect(counts.Outbound).toBe(4);
    expect(counts.Inbound).toBe(4);
    expect(counts.Replenishment).toBe(4);
    expect(counts.Inventory).toBe(5);
    expect(counts.CycleCounts).toBe(5);
    expect(counts.Returns).toBe(3);
    expect(counts.Admin).toBe(5);
  });
});

describe('POST /onboarding/start', () => {
  it('starts onboarding for a new user', async () => {
    const userId = testUserId('start-new');
    testUsers.push(userId);

    const res = await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('started');
    expect(res.body.step.step_number).toBe(1);
    expect(res.body.step.step_title).toBe('Logging In & Launching the WMS');
    expect(res.body.step.total_steps).toBe(4);
    expect(res.body.step.completed_count).toBe(0);
  });

  it('resumes for an in-progress user', async () => {
    const userId = testUserId('start-resume');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Picking' });

    const res = await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Picking' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resumed');
    expect(res.body.step).toBeDefined();
  });

  it('returns 400 when user_id is missing', async () => {
    const res = await request(app)
      .post('/onboarding/start')
      .send({ module: 'Navigation' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('user_id');
  });

  it('returns 400 when module is missing', async () => {
    const res = await request(app)
      .post('/onboarding/start')
      .send({ user_id: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('module');
  });

  it('returns 404 for non-existent module', async () => {
    const userId = testUserId('start-bad-mod');
    testUsers.push(userId);

    const res = await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'FakeModule' });

    expect(res.status).toBe(404);
  });
});

describe('POST /onboarding/step', () => {
  it('returns step content with explanation and citations', async () => {
    mockGenerate.mockResolvedValue(makeOnboardingResponse());

    const userId = testUserId('step-content');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    const res = await request(app)
      .post('/onboarding/step')
      .send({ user_id: userId, module: 'Navigation' });

    expect(res.status).toBe(200);
    expect(res.body.step_number).toBe(1);
    expect(res.body.step_title).toBe('Logging In & Launching the WMS');
    expect(res.body.total_steps).toBe(4);
    expect(res.body.completed_count).toBe(0);
    expect(typeof res.body.explanation).toBe('string');
    expect(res.body.explanation.length).toBeGreaterThan(0);
    expect(typeof res.body.quick_tip).toBe('string');
    expect(typeof res.body.checkpoint).toBe('string');
    expect(res.body.checkpoint).toContain('?');
    expect(Array.isArray(res.body.citations)).toBe(true);
    expect(res.body.citations.length).toBeGreaterThan(0);
    expect(res.body.next_action).toBe('complete_checkpoint');

    // Verify mocks were called
    expect(mockRetrieve).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('returns step 1 even for non-started user (LEFT JOIN with COALESCE defaults to step 1)', async () => {
    mockGenerate.mockResolvedValue(makeOnboardingResponse());

    const userId = testUserId('step-no-start');
    testUsers.push(userId);

    const res = await request(app)
      .post('/onboarding/step')
      .send({ user_id: userId, module: 'Navigation' });

    // The DB function defaults to step 1 via COALESCE even without a progress record
    expect(res.status).toBe(200);
    expect(res.body.step_number).toBe(1);
    expect(res.body.completed_count).toBe(0);
  });

  it('returns 404 for non-existent module in step', async () => {
    const res = await request(app)
      .post('/onboarding/step')
      .send({ user_id: 'anyone', module: 'FakeModule' });

    expect(res.status).toBe(404);
  });
});

describe('POST /onboarding/complete-step', () => {
  it('advances to next step', async () => {
    const userId = testUserId('complete-advance');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    const res = await request(app)
      .post('/onboarding/complete-step')
      .send({ user_id: userId, module: 'Navigation', step_number: 1 });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(false);
    expect(res.body.next_step).toBeDefined();
    expect(res.body.next_step.step_number).toBe(2);
    expect(res.body.next_step.step_title).toBe('Portal Layout & Menu Navigation');
    expect(res.body.next_step.completed_count).toBe(1);
  });

  it('completes module on final step', async () => {
    const userId = testUserId('complete-final');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Returns' });

    for (let step = 1; step <= 3; step++) {
      await request(app)
        .post('/onboarding/complete-step')
        .send({ user_id: userId, module: 'Returns', step_number: step });
    }

    const progress = await request(app)
      .get(`/onboarding/progress/${userId}`);

    const returnsProgress = progress.body.find(p => p.module === 'Returns');
    expect(returnsProgress).toBeDefined();
    expect(returnsProgress.status).toBe('completed');
    expect(returnsProgress.completed_at).not.toBeNull();
  });

  it('returns completed: true with congratulations on final step', async () => {
    const userId = testUserId('complete-msg');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Returns' });

    await request(app)
      .post('/onboarding/complete-step')
      .send({ user_id: userId, module: 'Returns', step_number: 1 });
    await request(app)
      .post('/onboarding/complete-step')
      .send({ user_id: userId, module: 'Returns', step_number: 2 });

    const res = await request(app)
      .post('/onboarding/complete-step')
      .send({ user_id: userId, module: 'Returns', step_number: 3 });

    expect(res.body.completed).toBe(true);
    expect(res.body.message).toContain('Congratulations');
    expect(res.body.message).toContain('Returns');
    expect(res.body.completed_steps).toBe(3);
    expect(res.body.total_steps).toBe(3);
  });

  it('returns 404 for unknown user', async () => {
    const res = await request(app)
      .post('/onboarding/complete-step')
      .send({ user_id: 'nonexistent_xyz', module: 'Navigation', step_number: 1 });

    expect(res.status).toBe(404);
  });
});

describe('POST /onboarding/validate-answer', () => {
  it('returns validation result with is_correct and feedback', async () => {
    mockGenerate.mockResolvedValue(makeQuizValidationResponse());

    const userId = testUserId('quiz-correct');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    const res = await request(app)
      .post('/onboarding/validate-answer')
      .send({
        user_id: userId,
        module: 'Navigation',
        step_number: 1,
        user_answer: 'Go to the portal, enter username and password, click login',
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.is_correct).toBe('boolean');
    expect(typeof res.body.feedback).toBe('string');
    expect(res.body.feedback.length).toBeGreaterThan(0);
    expect(res.body.attempts).toBe(1);
    expect(res.body.max_attempts).toBe(3);

    // Verify mock was called (not real API)
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it('tracks attempt count across submissions', async () => {
    mockGenerate.mockResolvedValue(makeQuizValidationResponse({ is_correct: false, feedback: 'Not quite.' }));

    const userId = testUserId('quiz-attempts');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    // Attempt 1
    const r1 = await request(app)
      .post('/onboarding/validate-answer')
      .send({ user_id: userId, module: 'Navigation', step_number: 1, user_answer: 'wrong' });
    expect(r1.body.attempts).toBe(1);
    expect(r1.body.can_proceed).toBe(false);

    // Attempt 2
    const r2 = await request(app)
      .post('/onboarding/validate-answer')
      .send({ user_id: userId, module: 'Navigation', step_number: 1, user_answer: 'still wrong' });
    expect(r2.body.attempts).toBe(2);
    expect(r2.body.can_proceed).toBe(false);

    // Attempt 3 — should allow proceed regardless
    const r3 = await request(app)
      .post('/onboarding/validate-answer')
      .send({ user_id: userId, module: 'Navigation', step_number: 1, user_answer: 'no idea' });
    expect(r3.body.attempts).toBe(3);
    expect(r3.body.can_proceed).toBe(true);
  });

  it('can_proceed is true on correct answer at any attempt', async () => {
    mockGenerate.mockResolvedValue(makeQuizValidationResponse({ is_correct: true, feedback: 'Great!' }));

    const userId = testUserId('quiz-proceed');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    const res = await request(app)
      .post('/onboarding/validate-answer')
      .send({ user_id: userId, module: 'Navigation', step_number: 1, user_answer: 'correct answer' });

    expect(res.body.is_correct).toBe(true);
    expect(res.body.can_proceed).toBe(true);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/onboarding/validate-answer')
      .send({ user_id: 'test', module: 'Navigation' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('required');
  });

  it('returns 404 for non-existent step', async () => {
    mockGenerate.mockResolvedValue(makeQuizValidationResponse());

    const res = await request(app)
      .post('/onboarding/validate-answer')
      .send({ user_id: 'test', module: 'Navigation', step_number: 99, user_answer: 'test' });

    expect(res.status).toBe(404);
  });
});

describe('GET /onboarding/progress/:user_id', () => {
  it('returns progress array for user', async () => {
    const userId = testUserId('progress');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    const res = await request(app).get(`/onboarding/progress/${userId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].module).toBe('Navigation');
    expect(res.body[0].status).toBe('in_progress');
    expect(parseInt(res.body[0].completed_count)).toBe(0);
    expect(parseInt(res.body[0].total_steps)).toBe(4);
  });

  it('returns empty array for unknown user', async () => {
    const res = await request(app).get('/onboarding/progress/nonexistent_xyz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('tracks multi-module progress', async () => {
    const userId = testUserId('multi-mod');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });
    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Picking' });

    const res = await request(app).get(`/onboarding/progress/${userId}`);

    expect(res.body.length).toBe(2);
    const modules = res.body.map(p => p.module).sort();
    expect(modules).toEqual(['Navigation', 'Picking']);
  });
});

describe('POST /onboarding/start — already_completed', () => {
  it('returns already_completed for finished module', async () => {
    const userId = testUserId('already-done');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Returns' });
    for (let s = 1; s <= 3; s++) {
      await request(app)
        .post('/onboarding/complete-step')
        .send({ user_id: userId, module: 'Returns', step_number: s });
    }

    const res = await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Returns' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('already_completed');
    expect(res.body.completed_at).toBeDefined();
  });
});

describe('Supervisor endpoints', () => {
  it('GET /onboarding/supervisor/dashboard returns array with expected fields', async () => {
    const res = await request(app).get('/onboarding/supervisor/dashboard');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const row = res.body[0];
      expect(row).toHaveProperty('user_id');
      expect(row).toHaveProperty('module');
      expect(row).toHaveProperty('status');
      expect(row).toHaveProperty('completion_percentage');
      expect(row).toHaveProperty('steps_completed');
      expect(row).toHaveProperty('total_steps');
    }
  });

  it('GET /onboarding/supervisor/summary returns module aggregates', async () => {
    const res = await request(app).get('/onboarding/supervisor/summary');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const row = res.body[0];
      expect(row).toHaveProperty('module');
      expect(row).toHaveProperty('total_users');
      expect(row).toHaveProperty('completed_users');
      expect(row).toHaveProperty('in_progress_users');
    }
  });

  it('GET /onboarding/supervisor/summary filters by module', async () => {
    const res = await request(app).get('/onboarding/supervisor/summary?module=Picking');

    expect(res.status).toBe(200);
    if (res.body.length > 0) {
      expect(res.body[0].module).toBe('Picking');
    }
  });

  it('GET /onboarding/supervisor/user/:user_id returns user detail', async () => {
    const userId = testUserId('supervisor-detail');
    testUsers.push(userId);

    await request(app)
      .post('/onboarding/start')
      .send({ user_id: userId, module: 'Navigation' });

    const res = await request(app).get(`/onboarding/supervisor/user/${userId}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].module).toBe('Navigation');
    expect(res.body[0]).toHaveProperty('completed_count');
    expect(res.body[0]).toHaveProperty('total_steps');
    expect(res.body[0]).toHaveProperty('current_step_title');
  });
});
