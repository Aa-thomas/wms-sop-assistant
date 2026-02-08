const express = require('express');
const { getPool } = require('../lib/retrieval');
const { analyzeGaps, generateSopDraft } = require('../lib/gap-analysis');

const router = express.Router();

// Trigger gap analysis
router.post('/analyze', async (req, res) => {
  const { period_days = 7 } = req.body || {};
  console.log(`[GAPS] Starting analysis for last ${period_days} days`);

  try {
    const result = await analyzeGaps(period_days);
    res.json(result);
  } catch (error) {
    console.error('[GAPS] Analysis failed:', error.message);
    res.status(500).json({ error: 'Gap analysis failed' });
  }
});

// Get latest run report with gaps
router.get('/report', async (req, res) => {
  const { status, severity } = req.query;

  try {
    const db = await getPool();

    // Latest completed run
    const runResult = await db.query(
      `SELECT * FROM gap_analysis_runs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1`
    );

    if (runResult.rows.length === 0) {
      return res.json({ run: null, gaps: [] });
    }

    const run = runResult.rows[0];

    // Build gap query with optional filters
    let gapQuery = 'SELECT * FROM knowledge_gaps WHERE run_id = $1';
    const params = [run.id];
    let paramIdx = 2;

    if (status) {
      gapQuery += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (severity) {
      gapQuery += ` AND severity = $${paramIdx}`;
      params.push(severity);
      paramIdx++;
    }

    gapQuery += ' ORDER BY CASE severity WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END, question_count DESC';

    const gapResult = await db.query(gapQuery, params);

    res.json({ run, gaps: gapResult.rows });
  } catch (error) {
    console.error('[GAPS] Report failed:', error.message);
    res.status(500).json({ error: 'Failed to load report' });
  }
});

// List past analysis runs
router.get('/runs', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.query(
      'SELECT * FROM gap_analysis_runs ORDER BY started_at DESC LIMIT 20'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[GAPS] Runs list failed:', error.message);
    res.status(500).json({ error: 'Failed to load runs' });
  }
});

// Update gap status
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['open', 'acknowledged', 'resolved', 'dismissed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const db = await getPool();
    const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';
    await db.query(
      `UPDATE knowledge_gaps SET status = $1, resolved_at = ${resolvedAt} WHERE id = $2`,
      [status, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[GAPS] Update failed:', error.message);
    res.status(500).json({ error: 'Failed to update gap' });
  }
});

// Generate/regenerate SOP draft
router.post('/:id/draft', async (req, res) => {
  const { id } = req.params;
  console.log(`[GAPS] Generating SOP draft for gap #${id}`);

  try {
    const draft = await generateSopDraft(id);
    res.json({ draft });
  } catch (error) {
    console.error('[GAPS] Draft generation failed:', error.message);
    res.status(500).json({ error: 'Failed to generate SOP draft' });
  }
});

module.exports = router;
