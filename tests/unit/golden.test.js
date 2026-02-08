import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Unit tests for findGoldenAnswer.
 * We inject a mock getPool via require.cache so golden.js sees our fake DB.
 */
const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

// Mock retrieval.js to provide a fake getPool
const retrievalPath = require.resolve('../../server/lib/retrieval');
delete require.cache[retrievalPath];
require.cache[retrievalPath] = {
  id: retrievalPath,
  filename: retrievalPath,
  loaded: true,
  exports: {
    retrieve: vi.fn(),
    getPool: async () => mockPool,
  },
};

// Clear golden.js cache so it picks up the mock
const goldenPath = require.resolve('../../server/lib/golden');
delete require.cache[goldenPath];
const { findGoldenAnswer } = require('../../server/lib/golden');

describe('findGoldenAnswer', () => {
  const fakeEmbedding = new Array(1536).fill(0.1);

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns null when no golden answers match', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const result = await findGoldenAnswer(fakeEmbedding, 'Navigation');
    expect(result).toBeNull();
  });

  it('returns the match when similarity > 0.92', async () => {
    mockQuery.mockResolvedValue({
      rows: [{
        question: 'How do I log in?',
        answer: { answer: [{ claim: 'Go to the portal', citations: [] }] },
        module: 'Navigation',
        similarity: 0.95,
      }],
    });

    const result = await findGoldenAnswer(fakeEmbedding, 'Navigation');
    expect(result).not.toBeNull();
    expect(result.question).toBe('How do I log in?');
    expect(result.similarity).toBe(0.95);
  });

  it('passes module filter to SQL params', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await findGoldenAnswer(fakeEmbedding, 'Picking');

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('golden_answers');
    expect(sql).toContain('0.92');
    expect(params[1]).toBe('Picking');
  });

  it('passes null module when no filter specified', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await findGoldenAnswer(fakeEmbedding, null);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[1]).toBeNull();
  });

  it('queries with LIMIT 1', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await findGoldenAnswer(fakeEmbedding, null);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toContain('LIMIT 1');
  });
});
