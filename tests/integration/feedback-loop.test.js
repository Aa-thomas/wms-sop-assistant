/**
 * Integration tests for the feedback learning loop.
 * Tests: /ask (interaction logging) and /feedback (update + golden promotion).
 *
 * Uses require.cache injection to mock external APIs (Claude, OpenAI, pgvector)
 * while hitting the real Express routes.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getPool: getTestPool, cleanupAllTestData, closePool } = require('../helpers/db-setup');

// --- Mock setup ---
const mockGenerate = vi.fn();
const mockRetrieve = vi.fn();
const mockFindGoldenAnswer = vi.fn();

const fakeEmbedding = new Array(1536).fill(0.01);

// Default mocks
mockRetrieve.mockResolvedValue({
  chunks: [
    {
      id: 'Test_SOP_slide_1',
      text: 'Step 1: Log in to the WMS portal.',
      doc_title: 'Test SOP',
      source_locator: 'Test SOP - Slide 1',
      slide_number: 1,
      module: 'Navigation',
      similarity: 0.85,
    },
  ],
  queryEmbedding: fakeEmbedding,
});

mockGenerate.mockResolvedValue({
  answer: [{ claim: 'Log in at the portal.', citations: [{ doc_title: 'Test SOP', source_locator: 'Slide 1', slide_number: 1 }] }],
  follow_up_question: null,
  coverage: { chunks_used: 1 },
});

mockFindGoldenAnswer.mockResolvedValue(null);

// Resolve and inject mocks
const generatePath = require.resolve('../../server/lib/generate');
const retrievalPath = require.resolve('../../server/lib/retrieval');
const goldenPath = require.resolve('../../server/lib/golden');

delete require.cache[generatePath];
delete require.cache[retrievalPath];
delete require.cache[goldenPath];

// We need a real getPool for interaction INSERT — get it from the db module
const realPool = require('../../server/lib/db');
const pgvector = require('pgvector/pg');

let pgvectorRegistered = false;
async function getRealPool() {
  if (!pgvectorRegistered) {
    const client = await realPool.connect();
    await pgvector.registerType(client);
    client.release();
    pgvectorRegistered = true;
  }
  return realPool;
}

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
  exports: { retrieve: mockRetrieve, getPool: getRealPool },
};

require.cache[goldenPath] = {
  id: goldenPath,
  filename: goldenPath,
  loaded: true,
  exports: { findGoldenAnswer: mockFindGoldenAnswer },
};

// Clear cached app/routes
const appPath = require.resolve('../../server/app');
const askRoutePath = require.resolve('../../server/routes/ask');
delete require.cache[appPath];
delete require.cache[askRoutePath];

const app = require('../../server/app');
const request = require('supertest');

// Track interaction IDs for cleanup
let createdInteractionIds = [];
let createdGoldenIds = [];

beforeAll(async () => {
  // Clean up any leftover test data from prior runs
  const db = await getRealPool();
  await db.query(`DELETE FROM golden_answers WHERE question LIKE '%test%' OR question LIKE '%Golden%' OR question LIKE '%cleanup%'`);
  await db.query(`DELETE FROM interactions WHERE question LIKE '%test%' OR question LIKE '%Golden%' OR question LIKE '%Feedback%' OR question LIKE '%Comment%' OR question LIKE '%cleanup%' OR question LIKE '%General%' OR question LIKE '%Should not%' OR question LIKE 'How do I log in?'`);

  // Ensure tables exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS interactions (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      module TEXT,
      answer JSONB NOT NULL,
      chunk_ids TEXT[],
      similarity_scores REAL[],
      question_embedding vector(1536),
      helpful BOOLEAN,
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS golden_answers (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      question_embedding vector(1536) NOT NULL,
      answer JSONB NOT NULL,
      module TEXT,
      source TEXT DEFAULT 'thumbs_up',
      interaction_id INT REFERENCES interactions(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
});

afterAll(async () => {
  // Clean up test data
  const db = await getRealPool();
  if (createdGoldenIds.length > 0) {
    const placeholders = createdGoldenIds.map((_, i) => `$${i + 1}`).join(', ');
    await db.query(`DELETE FROM golden_answers WHERE id IN (${placeholders})`, createdGoldenIds);
  }
  if (createdInteractionIds.length > 0) {
    const placeholders = createdInteractionIds.map((_, i) => `$${i + 1}`).join(', ');
    await db.query(`DELETE FROM interactions WHERE id IN (${placeholders})`, createdInteractionIds);
  }
  await realPool.end();
});

beforeEach(() => {
  mockGenerate.mockClear();
  mockRetrieve.mockClear();
  mockFindGoldenAnswer.mockClear();

  // Re-apply defaults
  mockRetrieve.mockResolvedValue({
    chunks: [
      {
        id: 'Test_SOP_slide_1',
        text: 'Step 1: Log in to the WMS portal.',
        doc_title: 'Test SOP',
        source_locator: 'Test SOP - Slide 1',
        slide_number: 1,
        module: 'Navigation',
        similarity: 0.85,
      },
    ],
    queryEmbedding: fakeEmbedding,
  });

  mockGenerate.mockResolvedValue({
    answer: [{ claim: 'Log in at the portal.', citations: [{ doc_title: 'Test SOP', source_locator: 'Slide 1', slide_number: 1 }] }],
    follow_up_question: null,
    coverage: { chunks_used: 1 },
  });

  mockFindGoldenAnswer.mockResolvedValue(null);
});

describe('POST /ask — interaction logging', () => {
  it('returns interaction_id in response', async () => {
    const res = await request(app)
      .post('/ask')
      .send({ question: 'How do I log in?', module: 'Navigation' });

    expect(res.status).toBe(200);
    expect(res.body.interaction_id).toBeDefined();
    expect(typeof res.body.interaction_id).toBe('number');
    createdInteractionIds.push(res.body.interaction_id);
  });

  it('logs interaction to database with correct fields', async () => {
    const res = await request(app)
      .post('/ask')
      .send({ question: 'How do I log in?', module: 'Navigation' });

    const id = res.body.interaction_id;
    createdInteractionIds.push(id);

    const db = await getRealPool();
    const row = await db.query('SELECT * FROM interactions WHERE id = $1', [id]);
    expect(row.rows).toHaveLength(1);

    const interaction = row.rows[0];
    expect(interaction.question).toBe('How do I log in?');
    expect(interaction.module).toBe('Navigation');
    expect(interaction.answer).toBeDefined();
    expect(interaction.chunk_ids).toContain('Test_SOP_slide_1');
    expect(interaction.similarity_scores[0]).toBeCloseTo(0.85, 1);
    expect(interaction.question_embedding).toBeDefined();
    expect(interaction.helpful).toBeNull();
  });

  it('calls findGoldenAnswer with the query embedding', async () => {
    await request(app)
      .post('/ask')
      .send({ question: 'Test question' });

    expect(mockFindGoldenAnswer).toHaveBeenCalledWith(fakeEmbedding, null);

    const res = await request(app)
      .post('/ask')
      .send({ question: 'Test question', module: 'Picking' });

    expect(mockFindGoldenAnswer).toHaveBeenCalledWith(fakeEmbedding, 'Picking');

    // Clean up
    createdInteractionIds.push(
      (await request(app).post('/ask').send({ question: 'cleanup' })).body.interaction_id
    );
  });

  it('still returns answer when golden lookup fails', async () => {
    mockFindGoldenAnswer.mockRejectedValue(new Error('DB down'));

    const res = await request(app)
      .post('/ask')
      .send({ question: 'How do I log in?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    createdInteractionIds.push(res.body.interaction_id);
  });

  it('includes sources in response', async () => {
    const res = await request(app)
      .post('/ask')
      .send({ question: 'How do I log in?' });

    expect(res.body.sources).toBeDefined();
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0].doc_title).toBe('Test SOP');
    createdInteractionIds.push(res.body.interaction_id);
  });
});

describe('POST /feedback — update + golden promotion', () => {
  it('requires interaction_id', async () => {
    const res = await request(app)
      .post('/feedback')
      .send({ helpful: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('interaction_id');
  });

  it('updates interaction helpful status', async () => {
    // Create an interaction first
    const askRes = await request(app)
      .post('/ask')
      .send({ question: 'Feedback test question' });
    const interactionId = askRes.body.interaction_id;
    createdInteractionIds.push(interactionId);

    // Submit negative feedback (avoids golden promotion which uses shared test embedding)
    const fbRes = await request(app)
      .post('/feedback')
      .send({ interaction_id: interactionId, helpful: false });

    expect(fbRes.status).toBe(200);
    expect(fbRes.body.success).toBe(true);

    // Verify in DB
    const db = await getRealPool();
    const row = await db.query('SELECT helpful FROM interactions WHERE id = $1', [interactionId]);
    expect(row.rows[0].helpful).toBe(false);
  });

  it('stores comment on thumbs-down', async () => {
    const askRes = await request(app)
      .post('/ask')
      .send({ question: 'Comment test question' });
    const interactionId = askRes.body.interaction_id;
    createdInteractionIds.push(interactionId);

    await request(app)
      .post('/feedback')
      .send({ interaction_id: interactionId, helpful: false, comment: 'Wrong procedure shown' });

    const db = await getRealPool();
    const row = await db.query('SELECT helpful, comment FROM interactions WHERE id = $1', [interactionId]);
    expect(row.rows[0].helpful).toBe(false);
    expect(row.rows[0].comment).toBe('Wrong procedure shown');
  });

  it('promotes thumbs-up to golden answers', async () => {
    const askRes = await request(app)
      .post('/ask')
      .send({ question: 'Golden promotion test', module: 'Navigation' });
    const interactionId = askRes.body.interaction_id;
    createdInteractionIds.push(interactionId);

    await request(app)
      .post('/feedback')
      .send({ interaction_id: interactionId, helpful: true });

    // Check golden_answers table
    const db = await getRealPool();
    const golden = await db.query(
      'SELECT * FROM golden_answers WHERE interaction_id = $1',
      [interactionId]
    );
    expect(golden.rows).toHaveLength(1);
    expect(golden.rows[0].question).toBe('Golden promotion test');
    expect(golden.rows[0].module).toBe('Navigation');
    expect(golden.rows[0].source).toBe('thumbs_up');
    createdGoldenIds.push(golden.rows[0].id);
  });

  it('does not promote thumbs-down to golden answers', async () => {
    const askRes = await request(app)
      .post('/ask')
      .send({ question: 'Should not be golden' });
    const interactionId = askRes.body.interaction_id;
    createdInteractionIds.push(interactionId);

    await request(app)
      .post('/feedback')
      .send({ interaction_id: interactionId, helpful: false });

    const db = await getRealPool();
    const golden = await db.query(
      'SELECT * FROM golden_answers WHERE interaction_id = $1',
      [interactionId]
    );
    expect(golden.rows).toHaveLength(0);
  });
});

describe('POST /ask — validation', () => {
  it('rejects empty question', async () => {
    const res = await request(app)
      .post('/ask')
      .send({ question: '' });
    expect(res.status).toBe(400);
  });

  it('rejects question over 500 chars', async () => {
    const res = await request(app)
      .post('/ask')
      .send({ question: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('works without module filter', async () => {
    const res = await request(app)
      .post('/ask')
      .send({ question: 'General question' });
    expect(res.status).toBe(200);
    createdInteractionIds.push(res.body.interaction_id);
  });
});
