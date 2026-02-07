// server/routes/onboarding.js

const express = require('express');
const router = express.Router();
const db = require('../lib/db'); // your existing Postgres connection
const { retrieve } = require('../lib/retrieval');
const { buildOnboardingPrompt } = require('../lib/prompt');
const { generate } = require('../lib/generate');

/**
 * POST /onboarding/start
 * Start onboarding for a module
 * 
 * Body: { user_id, module }
 * Returns: { step, total_steps, message }
 */
router.post('/start', async (req, res) => {
  const { user_id, module } = req.body;
  
  if (!user_id || !module) {
    return res.status(400).json({ error: 'user_id and module required' });
  }
  
  try {
    // Check if user already has progress
    const existing = await db.query(
      'SELECT * FROM onboarding_progress WHERE user_id = $1 AND module = $2',
      [user_id, module]
    );
    
    if (existing.rows.length > 0) {
      // Resume existing progress
      const progress = existing.rows[0];
      
      if (progress.completed_at) {
        return res.json({
          status: 'already_completed',
          message: `You've already completed ${module} onboarding!`,
          completed_at: progress.completed_at
        });
      }
      
      // Get current step
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
    
    // Create new progress record
    await db.query(
      `INSERT INTO onboarding_progress (user_id, module, current_step)
       VALUES ($1, $2, 1)`,
      [user_id, module]
    );
    
    // Get first step
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
      message: `Welcome to ${module} Module Onboarding! 🎯`
    });
    
  } catch (error) {
    console.error('Error starting onboarding:', error);
    return res.status(500).json({ error: 'Failed to start onboarding' });
  }
});

/**
 * POST /onboarding/step
 * Get explanation for current step
 * 
 * Body: { user_id, module }
 * Returns: { explanation, checkpoint, citations, next_action }
 */
router.post('/step', async (req, res) => {
  const { user_id, module } = req.body;
  
  try {
    // Get current step info
    const stepResult = await db.query(
      'SELECT * FROM get_next_onboarding_step($1, $2)',
      [user_id, module]
    );
    
    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'No active onboarding found' });
    }
    
    const step = stepResult.rows[0];
    
    // Retrieve relevant chunks using step's search queries
    const allChunks = [];
    for (const query of step.search_queries) {
      const chunks = await retrieve(query, module);
      allChunks.push(...chunks);
    }
    
    // Deduplicate chunks by ID
    const uniqueChunks = Array.from(
      new Map(allChunks.map(c => [c.id, c])).values()
    ).slice(0, 10);
    
    // Build onboarding-specific prompt
    const prompt = buildOnboardingPrompt(step, uniqueChunks);
    
    // Generate explanation
    const response = await generate(prompt);
    
    return res.json({
      step_number: step.step_number,
      step_title: step.step_title,
      total_steps: step.total_steps,
      completed_count: step.completed_count,
      explanation: response.explanation,
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
 * 
 * Body: { user_id, module, step_number }
 * Returns: { next_step } or { completed: true }
 */
router.post('/complete-step', async (req, res) => {
  const { user_id, module, step_number } = req.body;
  
  try {
    // Update progress
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
    
    // Check if this was the last step
    const totalSteps = await db.query(
      'SELECT COUNT(*) as total FROM onboarding_curriculum WHERE module = $1',
      [module]
    );
    
    const completed = result.rows[0].completed_steps.length;
    const total = parseInt(totalSteps.rows[0].total);
    
    if (completed >= total) {
      // Mark as completed
      await db.query(
        `UPDATE onboarding_progress
         SET completed_at = NOW()
         WHERE user_id = $1 AND module = $2`,
        [user_id, module]
      );
      
      return res.json({
        completed: true,
        message: `Congratulations! 🎉 You've completed ${module} module onboarding!`,
        completed_steps: completed,
        total_steps: total
      });
    }
    
    // Get next step
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
 * 
 * Returns: [ { module, progress, status } ]
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
 * 
 * Returns: [ { module, steps, description } ]
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

module.exports = router;
