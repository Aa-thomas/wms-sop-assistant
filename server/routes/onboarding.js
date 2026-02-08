const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { retrieve } = require('../lib/retrieval');
const { buildOnboardingPrompt, buildQuizValidationPrompt } = require('../lib/prompt');
const { generate } = require('../lib/generate');

/**
 * POST /onboarding/start
 * Start onboarding for a module
 */
router.post('/start', async (req, res) => {
  const { user_id, module } = req.body;

  if (!user_id || !module) {
    return res.status(400).json({ error: 'user_id and module required' });
  }

  try {
    const existing = await db.query(
      'SELECT * FROM onboarding_progress WHERE user_id = $1 AND module = $2',
      [user_id, module]
    );

    if (existing.rows.length > 0) {
      const progress = existing.rows[0];

      if (progress.completed_at) {
        return res.json({
          status: 'already_completed',
          message: `You've already completed ${module} onboarding!`,
          completed_at: progress.completed_at
        });
      }

      const step = await db.query(
        'SELECT * FROM get_next_onboarding_step($1, $2)',
        [user_id, module]
      );

      return res.json({
        status: 'resumed',
        step: step.rows[0],
        message: `Welcome back! Let's continue where you left off.`
      });
    }

    await db.query(
      `INSERT INTO onboarding_progress (user_id, module, current_step)
       VALUES ($1, $2, 1)`,
      [user_id, module]
    );

    const step = await db.query(
      'SELECT * FROM get_next_onboarding_step($1, $2)',
      [user_id, module]
    );

    if (step.rows.length === 0) {
      return res.status(404).json({
        error: `No curriculum found for module: ${module}`
      });
    }

    return res.json({
      status: 'started',
      step: step.rows[0],
      message: `Welcome to ${module} Module Onboarding!`
    });

  } catch (error) {
    console.error('Error starting onboarding:', error);
    return res.status(500).json({ error: 'Failed to start onboarding' });
  }
});

/**
 * POST /onboarding/step
 * Get explanation for current step
 */
router.post('/step', async (req, res) => {
  const { user_id, module } = req.body;

  try {
    const stepResult = await db.query(
      'SELECT * FROM get_next_onboarding_step($1, $2)',
      [user_id, module]
    );

    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active onboarding found' });
    }

    const step = stepResult.rows[0];

    const allChunks = [];
    for (const query of step.search_queries) {
      const { chunks } = await retrieve(query, module);
      allChunks.push(...chunks);
    }

    const uniqueChunks = Array.from(
      new Map(allChunks.map(c => [c.id, c])).values()
    ).slice(0, 10);

    const prompt = buildOnboardingPrompt(step, uniqueChunks);
    const response = await generate(prompt);

    return res.json({
      step_number: step.step_number,
      step_title: step.step_title,
      total_steps: step.total_steps,
      completed_count: step.completed_count,
      explanation: response.explanation,
      quick_tip: response.quick_tip,
      common_mistake: response.common_mistake,
      checkpoint: step.checkpoint_question,
      citations: response.citations,
      next_action: 'complete_checkpoint'
    });

  } catch (error) {
    console.error('Error getting step:', error);
    return res.status(500).json({ error: 'Failed to get step content' });
  }
});

/**
 * POST /onboarding/complete-step
 * Mark current step as complete and move to next
 */
router.post('/complete-step', async (req, res) => {
  const { user_id, module, step_number } = req.body;

  try {
    const result = await db.query(
      `UPDATE onboarding_progress
       SET completed_steps = array_append(COALESCE(completed_steps, ARRAY[]::INT[]), $3),
           current_step = $3 + 1,
           last_activity = NOW()
       WHERE user_id = $1 AND module = $2
       RETURNING *`,
      [user_id, module, step_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    const totalSteps = await db.query(
      'SELECT COUNT(*) as total FROM onboarding_curriculum WHERE module = $1',
      [module]
    );

    const completed = result.rows[0].completed_steps.length;
    const total = parseInt(totalSteps.rows[0].total);

    if (completed >= total) {
      await db.query(
        `UPDATE onboarding_progress
         SET completed_at = NOW()
         WHERE user_id = $1 AND module = $2`,
        [user_id, module]
      );

      return res.json({
        completed: true,
        message: `Congratulations! You've completed ${module} module onboarding!`,
        completed_steps: completed,
        total_steps: total
      });
    }

    const nextStep = await db.query(
      'SELECT * FROM get_next_onboarding_step($1, $2)',
      [user_id, module]
    );

    return res.json({
      completed: false,
      next_step: nextStep.rows[0],
      message: `Great job! Moving to next topic...`
    });

  } catch (error) {
    console.error('Error completing step:', error);
    return res.status(500).json({ error: 'Failed to complete step' });
  }
});

/**
 * GET /onboarding/progress/:user_id
 * Get all onboarding progress for a user
 */
router.get('/progress/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await db.query(
      `SELECT
        p.module,
        p.current_step,
        COALESCE(array_length(p.completed_steps, 1), 0) as completed_count,
        (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
        p.started_at,
        p.completed_at,
        CASE
          WHEN p.completed_at IS NOT NULL THEN 'completed'
          ELSE 'in_progress'
        END as status
       FROM onboarding_progress p
       WHERE p.user_id = $1
       ORDER BY p.last_activity DESC`,
      [user_id]
    );

    return res.json(result.rows);

  } catch (error) {
    console.error('Error getting progress:', error);
    return res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * GET /onboarding/available
 * Get list of available onboarding modules
 */
router.get('/available', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        module,
        COUNT(*) as total_steps,
        string_agg(step_title, ', ' ORDER BY step_number) as topics
       FROM onboarding_curriculum
       GROUP BY module
       ORDER BY module`
    );

    return res.json(result.rows);

  } catch (error) {
    console.error('Error getting available modules:', error);
    return res.status(500).json({ error: 'Failed to get modules' });
  }
});

/**
 * POST /onboarding/validate-answer
 * Validate user's answer to checkpoint question using Claude
 */
router.post('/validate-answer', async (req, res) => {
  const { user_id, module, step_number, user_answer } = req.body;

  if (!user_id || !module || !step_number || !user_answer) {
    return res.status(400).json({ error: 'user_id, module, step_number, and user_answer required' });
  }

  try {
    const stepResult = await db.query(
      `SELECT checkpoint_question, search_queries
       FROM onboarding_curriculum
       WHERE module = $1 AND step_number = $2`,
      [module, step_number]
    );

    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'Step not found' });
    }

    const step = stepResult.rows[0];

    // Retrieve relevant chunks for context
    const allChunks = [];
    for (const query of step.search_queries) {
      const { chunks } = await retrieve(query, module);
      allChunks.push(...chunks);
    }

    const uniqueChunks = Array.from(
      new Map(allChunks.map(c => [c.id, c])).values()
    ).slice(0, 5);

    const prompt = buildQuizValidationPrompt(
      step.checkpoint_question,
      user_answer,
      uniqueChunks
    );

    const validation = await generate(prompt);

    // Count previous attempts
    const attemptsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM onboarding_quiz_attempts
       WHERE user_id = $1 AND module = $2 AND step_number = $3`,
      [user_id, module, step_number]
    );

    const attemptNumber = parseInt(attemptsResult.rows[0].count) + 1;

    // Store attempt
    await db.query(
      `INSERT INTO onboarding_quiz_attempts
       (user_id, module, step_number, question, user_answer, is_correct, feedback, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user_id, module, step_number, step.checkpoint_question, user_answer,
       validation.is_correct, validation.feedback, attemptNumber]
    );

    const canProceed = validation.is_correct || attemptNumber >= 3;

    return res.json({
      is_correct: validation.is_correct,
      feedback: validation.feedback,
      can_proceed: canProceed,
      attempts: attemptNumber,
      max_attempts: 3
    });

  } catch (error) {
    console.error('Error validating answer:', error);
    return res.status(500).json({ error: 'Failed to validate answer' });
  }
});

/**
 * GET /onboarding/supervisor/dashboard
 * Get complete team onboarding status
 */
router.get('/supervisor/dashboard', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM supervisor_onboarding_dashboard'
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * GET /onboarding/supervisor/summary
 * Get aggregated statistics by module
 */
router.get('/supervisor/summary', async (req, res) => {
  const { module } = req.query;

  try {
    const result = await db.query(
      'SELECT * FROM get_module_summary($1)',
      [module || null]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting summary:', error);
    return res.status(500).json({ error: 'Failed to load summary' });
  }
});

/**
 * GET /onboarding/supervisor/user/:user_id
 * Get detailed progress for a specific user
 */
router.get('/supervisor/user/:user_id', async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await db.query(
      `SELECT
        p.module,
        p.completed_steps,
        p.current_step,
        (SELECT step_title FROM onboarding_curriculum
         WHERE module = p.module AND step_number = p.current_step) as current_step_title,
        COALESCE(array_length(p.completed_steps, 1), 0) as completed_count,
        (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
        p.started_at,
        p.completed_at,
        p.last_activity
       FROM onboarding_progress p
       WHERE p.user_id = $1
       ORDER BY p.last_activity DESC`,
      [user_id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting user details:', error);
    return res.status(500).json({ error: 'Failed to load user details' });
  }
});

module.exports = router;
