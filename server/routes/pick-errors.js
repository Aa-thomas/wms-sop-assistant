const express = require('express');
const { getPool } = require('../lib/retrieval');
const { generate } = require('../lib/generate');
const { buildPickErrorAnalysisPrompt } = require('../lib/prompt');

const router = express.Router();

// Record a new pick error
router.post('/', async (req, res) => {
  const { user_id, pps_number, shipment_number, item, quantity_variance, notes } = req.body;

  if (!user_id || !pps_number || !shipment_number || !item || quantity_variance === undefined) {
    return res.status(400).json({ error: 'Missing required fields: user_id, pps_number, shipment_number, item, quantity_variance' });
  }

  try {
    const db = await getPool();
    const result = await db.query(
      `INSERT INTO pick_errors (user_id, pps_number, shipment_number, item, quantity_variance, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [user_id, pps_number, shipment_number, item, parseInt(quantity_variance), notes || null, req.user.id]
    );
    console.log(`[PICK-ERRORS] Recorded error for user ${user_id} by supervisor ${req.user.id}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('[PICK-ERRORS] Create failed:', error.message);
    res.status(500).json({ error: 'Failed to record pick error' });
  }
});

// List all errors (optional user_id filter)
router.get('/', async (req, res) => {
  const { user_id } = req.query;

  try {
    const db = await getPool();
    let query = 'SELECT * FROM pick_errors';
    const params = [];

    if (user_id) {
      query += ' WHERE user_id = $1';
      params.push(user_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('[PICK-ERRORS] List failed:', error.message);
    res.status(500).json({ error: 'Failed to load pick errors' });
  }
});

// Per-user error summary
router.get('/user/:user_id/summary', async (req, res) => {
  const { user_id } = req.params;

  try {
    const db = await getPool();

    const statsResult = await db.query(
      `SELECT
        COUNT(*)::int AS total_errors,
        ROUND(AVG(quantity_variance), 1) AS avg_variance,
        MIN(created_at) AS first_error,
        MAX(created_at) AS last_error
      FROM pick_errors
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [user_id]
    );

    const topItemsResult = await db.query(
      `SELECT item, COUNT(*)::int AS cnt
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       GROUP BY item ORDER BY cnt DESC LIMIT 3`,
      [user_id]
    );

    const topPpsResult = await db.query(
      `SELECT pps_number, COUNT(*)::int AS cnt
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       GROUP BY pps_number ORDER BY cnt DESC LIMIT 3`,
      [user_id]
    );

    const stats = statsResult.rows[0];
    res.json({
      total_errors: stats.total_errors,
      avg_variance: parseFloat(stats.avg_variance) || 0,
      first_error: stats.first_error,
      last_error: stats.last_error,
      top_items: topItemsResult.rows.map(r => r.item),
      top_pps: topPpsResult.rows.map(r => r.pps_number)
    });
  } catch (error) {
    console.error('[PICK-ERRORS] Summary failed:', error.message);
    res.status(500).json({ error: 'Failed to load error summary' });
  }
});

// AI analysis of user's error patterns
router.post('/user/:user_id/analyze', async (req, res) => {
  const { user_id } = req.params;
  console.log(`[PICK-ERRORS] Analyzing errors for user ${user_id}`);

  try {
    const db = await getPool();

    // Get user's errors from last 90 days
    const errorsResult = await db.query(
      `SELECT * FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC`,
      [user_id]
    );

    if (errorsResult.rows.length === 0) {
      return res.json({ tips: [], summary: 'No errors recorded in the last 90 days.' });
    }

    // Get username
    const userResult = await db.query('SELECT username FROM users WHERE id::text = $1', [user_id]);
    const username = userResult.rows[0]?.username || `User ${user_id}`;

    // Build stats
    const errors = errorsResult.rows;
    const itemCounts = {};
    const ppsCounts = {};
    let totalVariance = 0;

    for (const e of errors) {
      itemCounts[e.item] = (itemCounts[e.item] || 0) + 1;
      ppsCounts[e.pps_number] = (ppsCounts[e.pps_number] || 0) + 1;
      totalVariance += e.quantity_variance;
    }

    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([item]) => item);
    const topPps = Object.entries(ppsCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([pps]) => pps);

    const stats = {
      total_errors: errors.length,
      avg_variance: (totalVariance / errors.length).toFixed(1),
      top_items: topItems,
      top_pps: topPps,
      date_range: `${new Date(errors[errors.length - 1].created_at).toLocaleDateString()} — ${new Date(errors[0].created_at).toLocaleDateString()}`
    };

    const prompt = buildPickErrorAnalysisPrompt(username, errors, stats);
    const result = await generate(prompt);

    res.json(result);
  } catch (error) {
    console.error('[PICK-ERRORS] Analysis failed:', error.message);
    res.status(500).json({ error: 'Failed to analyze pick errors' });
  }
});

module.exports = router;
