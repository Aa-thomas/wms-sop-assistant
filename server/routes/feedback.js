const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { supervisorMiddleware } = require('../lib/auth');

/**
 * POST /feedback/anonymous
 * Submit anonymous feedback (authenticated but user not logged)
 */
router.post('/anonymous', async (req, res) => {
  const { type, category, message, urgency } = req.body;

  // Validation
  if (!type || !['complaint', 'suggestion', 'feedback'].includes(type)) {
    return res.status(400).json({ error: 'Valid type required (complaint/suggestion/feedback)' });
  }
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message must be 2000 characters or less' });
  }

  const validCategories = ['workflow', 'safety', 'equipment', 'training', 'management', 'other'];
  const validUrgency = ['low', 'normal', 'high'];

  try {
    const result = await db.query(
      `INSERT INTO anonymous_feedback (type, category, message, urgency)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        type,
        validCategories.includes(category) ? category : 'other',
        message.trim(),
        validUrgency.includes(urgency) ? urgency : 'normal'
      ]
    );

    console.log(`[FEEDBACK] Anonymous ${type} submitted (ID: ${result.rows[0].id})`);
    res.json({ success: true, message: 'Your feedback has been submitted anonymously.' });
  } catch (error) {
    console.error('[FEEDBACK] Error submitting:', error.message);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * GET /feedback/anonymous
 * List all anonymous feedback (supervisor only)
 */
router.get('/anonymous', supervisorMiddleware, async (req, res) => {
  const { status, type, limit = 50 } = req.query;

  try {
    let query = `
      SELECT * FROM anonymous_feedback
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (type) {
      query += ` AND type = $${paramIdx++}`;
      params.push(type);
    }

    query += ` ORDER BY 
      CASE urgency WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      CASE status WHEN 'new' THEN 1 WHEN 'reviewed' THEN 2 ELSE 3 END,
      created_at DESC
      LIMIT $${paramIdx}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('[FEEDBACK] Error listing:', error.message);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
});

/**
 * GET /feedback/anonymous/summary
 * Get feedback summary counts (supervisor only)
 */
router.get('/anonymous/summary', supervisorMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM feedback_summary');
    res.json(result.rows[0] || {
      new_count: 0,
      reviewed_count: 0,
      actioned_count: 0,
      dismissed_count: 0,
      high_urgency_new: 0,
      new_complaints: 0,
      new_suggestions: 0,
      last_24h: 0,
      last_7d: 0
    });
  } catch (error) {
    console.error('[FEEDBACK] Error getting summary:', error.message);
    res.status(500).json({ error: 'Failed to load feedback summary' });
  }
});

/**
 * PATCH /feedback/anonymous/:id
 * Update feedback status/notes (supervisor only)
 */
router.patch('/anonymous/:id', supervisorMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, supervisor_notes } = req.body;

  const validStatuses = ['new', 'reviewed', 'actioned', 'dismissed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (status) {
      updates.push(`status = $${paramIdx++}`);
      params.push(status);
      if (status !== 'new') {
        updates.push(`reviewed_at = COALESCE(reviewed_at, NOW())`);
        updates.push(`reviewed_by = COALESCE(reviewed_by, $${paramIdx++})`);
        params.push(req.user.username);
      }
    }
    if (supervisor_notes !== undefined) {
      updates.push(`supervisor_notes = $${paramIdx++}`);
      params.push(supervisor_notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(id);
    const result = await db.query(
      `UPDATE anonymous_feedback
       SET ${updates.join(', ')}
       WHERE id = $${paramIdx}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('[FEEDBACK] Error updating:', error.message);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

module.exports = router;
