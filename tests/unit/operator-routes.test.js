import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const express = require('express');
const request = require('supertest');

const mockQuery = vi.fn();
const mockGenerateOperatorBriefing = vi.fn();

const dbPath = require.resolve('../../server/lib/db');
const briefingPath = require.resolve('../../server/lib/operator-briefing');
const routePath = require.resolve('../../server/routes/operator');

function buildApp() {
  delete require.cache[dbPath];
  delete require.cache[briefingPath];
  delete require.cache[routePath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { query: mockQuery },
  };

  require.cache[briefingPath] = {
    id: briefingPath,
    filename: briefingPath,
    loaded: true,
    exports: {
      generateOperatorBriefing: mockGenerateOperatorBriefing,
      aggregateOperatorData: vi.fn(),
    },
  };

  const operatorRouter = require('../../server/routes/operator');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 321, username: 'operator_321' };
    next();
  });
  app.use('/operator', operatorRouter);
  return app;
}

beforeEach(() => {
  mockQuery.mockReset();
  mockGenerateOperatorBriefing.mockReset();
});

describe('operator routes', () => {
  it('GET /operator/briefing returns generated briefing', async () => {
    const app = buildApp();
    mockGenerateOperatorBriefing.mockResolvedValue({
      generated_at: '2026-02-08T00:00:00.000Z',
      user: { id: '321', username: 'operator_321' },
      metrics: { health_status: 'healthy' },
      insights: { summary: 'Good momentum today.' },
    });

    const res = await request(app).get('/operator/briefing');

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('operator_321');
    expect(mockGenerateOperatorBriefing).toHaveBeenCalledWith('321', 'operator_321');
  });

  it('GET /operator/health returns safe defaults when no health row exists', async () => {
    const app = buildApp();
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/operator/health');

    expect(res.status).toBe(200);
    expect(res.body.health_status).toBe('unknown');
    expect(res.body.modules_completed).toBe(0);
    expect(res.body.quiz_correct_rate).toBe(0);
  });

  it('GET /operator/onboarding returns module progress rows', async () => {
    const app = buildApp();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          module: 'Picking',
          current_step: 3,
          completed_count: 2,
          total_steps: 5,
          status: 'active',
          last_activity: '2026-02-08T00:00:00.000Z',
        },
      ],
    });

    const res = await request(app).get('/operator/onboarding');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].module).toBe('Picking');
  });

  it('GET /operator/errors returns summary, recent errors, and top items', async () => {
    const app = buildApp();
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_errors: 3,
            errors_7d: 1,
            errors_30d: 2,
            avg_variance: '1.3',
            first_error: '2026-01-01T00:00:00.000Z',
            last_error: '2026-02-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            pps_number: 'PPS-10',
            shipment_number: 'SHIP-1',
            item: 'SKU-10',
            quantity_variance: -1,
            notes: 'Short',
            created_at: '2026-02-01T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ item: 'SKU-10', count: 2 }],
      });

    const res = await request(app).get('/operator/errors');

    expect(res.status).toBe(200);
    expect(res.body.summary.total_errors).toBe(3);
    expect(res.body.recent_errors).toHaveLength(1);
    expect(res.body.top_items[0].item).toBe('SKU-10');
  });

  it('GET /operator/errors/trends returns week labels and values arrays', async () => {
    const app = buildApp();
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          week: '2026-01-12T00:00:00.000Z',
          error_count: 2,
        },
      ],
    });

    const res = await request(app).get('/operator/errors/trends');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.weeks.length).toBe(res.body.data.length);
    expect(res.body.data.some((v) => v >= 0)).toBe(true);
  });
});
