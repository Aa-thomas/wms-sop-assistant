const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { generateOperatorBriefing, aggregateOperatorData } = require('../lib/operator-briefing');

/**
 * GET /operator/briefing
 * Get personalized AI briefing for the authenticated operator
 */
router.get('/briefing', async (req, res) => {
  const userId = req.user.id.toString();
  const username = req.user.username;

  try {
    const briefing = await generateOperatorBriefing(userId, username);
    res.json(briefing);
  } catch (error) {
    console.error('[OPERATOR] Briefing failed:', error.message);
    res.status(500).json({ error: 'Failed to generate briefing' });
  }
});

/**
 * GET /operator/health
 * Get personal health metrics for the authenticated operator
 */
router.get('/health', async (req, res) => {
  const userId = req.user.id.toString();

  try {
    const result = await db.query(
      'SELECT * FROM user_learning_health WHERE user_id::text = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        health_status: 'unknown',
        modules_started: 0,
        modules_completed: 0,
        modules_stalled: 0,
        modules_active: 0,
        quiz_correct_rate: 0,
        quiz_avg_attempts: 0,
        chat_questions_asked: 0,
        last_activity: null
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[OPERATOR] Health query failed:', error.message);
    res.status(500).json({ error: 'Failed to load health data' });
  }
});

/**
 * GET /operator/weaknesses
 * Get personal knowledge weaknesses for the authenticated operator
 */
router.get('/weaknesses', async (req, res) => {
  const userId = req.user.id.toString();

  try {
    const result = await db.query(
      'SELECT * FROM user_knowledge_weaknesses WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[OPERATOR] Weaknesses query failed:', error.message);
    res.status(500).json({ error: 'Failed to load weaknesses' });
  }
});

/**
 * GET /operator/onboarding
 * Get personal onboarding progress for the authenticated operator
 */
router.get('/onboarding', async (req, res) => {
  const userId = req.user.id.toString();

  try {
    const result = await db.query(
      `SELECT
        p.module,
        p.current_step,
        COALESCE(array_length(p.completed_steps, 1), 0) as completed_count,
        (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
        (SELECT step_title FROM onboarding_curriculum 
         WHERE module = p.module AND step_number = p.current_step) as current_step_title,
        p.started_at,
        p.completed_at,
        p.last_activity,
        CASE
          WHEN p.completed_at IS NOT NULL THEN 'completed'
          WHEN p.last_activity < NOW() - INTERVAL '7 days' THEN 'stalled'
          ELSE 'active'
        END as status
       FROM onboarding_progress p
       WHERE p.user_id = $1
       ORDER BY 
         CASE 
           WHEN p.completed_at IS NULL AND p.last_activity >= NOW() - INTERVAL '7 days' THEN 0
           WHEN p.completed_at IS NULL THEN 1
           ELSE 2
         END,
         p.last_activity DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[OPERATOR] Onboarding query failed:', error.message);
    res.status(500).json({ error: 'Failed to load onboarding progress' });
  }
});

/**
 * GET /operator/errors
 * Get personal pick errors for the authenticated operator
 */
router.get('/errors', async (req, res) => {
  const userId = req.user.id.toString();

  try {
    // Get summary stats
    const statsResult = await db.query(
      `SELECT
        COUNT(*)::int AS total_errors,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS errors_7d,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS errors_30d,
        ROUND(AVG(ABS(quantity_variance))::numeric, 1) AS avg_variance,
        MIN(created_at) AS first_error,
        MAX(created_at) AS last_error
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [userId]
    );

    // Get recent errors
    const errorsResult = await db.query(
      `SELECT id, pps_number, shipment_number, item, quantity_variance, notes, created_at
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    // Get top problematic items
    const topItemsResult = await db.query(
      `SELECT item, COUNT(*)::int AS count
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       GROUP BY item ORDER BY count DESC LIMIT 3`,
      [userId]
    );

    res.json({
      summary: statsResult.rows[0],
      recent_errors: errorsResult.rows,
      top_items: topItemsResult.rows
    });
  } catch (error) {
    console.error('[OPERATOR] Errors query failed:', error.message);
    res.status(500).json({ error: 'Failed to load pick errors' });
  }
});

/**
 * GET /operator/errors/trends
 * Get personal pick error trends for the authenticated operator
 */
router.get('/errors/trends', async (req, res) => {
  const userId = req.user.id.toString();

  try {
    const result = await db.query(
      `SELECT
        DATE_TRUNC('week', created_at)::date AS week,
        COUNT(*)::int AS error_count
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       GROUP BY week
       ORDER BY week ASC`,
      [userId]
    );

    // Build week list
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

    const weeks = [];
    const data = [];
    const cursor = new Date(start);

    while (cursor <= now) {
      const weekStr = cursor.toISOString().split('T')[0];
      weeks.push(cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      
      const row = result.rows.find(r => 
        new Date(r.week).toISOString().split('T')[0] === weekStr
      );
      data.push(row ? row.error_count : 0);
      
      cursor.setDate(cursor.getDate() + 7);
    }

    res.json({ weeks, data });
  } catch (error) {
    console.error('[OPERATOR] Trends query failed:', error.message);
    res.status(500).json({ error: 'Failed to load trend data' });
  }
});

module.exports = router;
