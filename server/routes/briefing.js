const express = require('express');
const router = express.Router();
const { generateDailyBriefing, aggregateBriefingData } = require('../lib/briefing');

/**
 * GET /briefing/daily
 * Generate the full daily briefing with AI insights
 */
router.get('/daily', async (req, res) => {
  try {
    console.log('[BRIEFING] Generating daily briefing...');
    const briefing = await generateDailyBriefing();
    console.log('[BRIEFING] Briefing generated successfully');
    res.json(briefing);
  } catch (error) {
    console.error('[BRIEFING] Error generating briefing:', error.message);
    res.status(500).json({ error: 'Failed to generate daily briefing' });
  }
});

/**
 * GET /briefing/metrics
 * Get just the raw metrics without AI (faster, for refreshing)
 */
router.get('/metrics', async (req, res) => {
  try {
    const data = await aggregateBriefingData();
    res.json({
      generated_at: new Date().toISOString(),
      metrics: {
        teamHealth: data.teamHealth,
        onboarding: data.onboarding,
        knowledgeGaps: data.knowledgeGaps,
        pickErrors: data.pickErrors,
        feedback: data.feedback
      },
      urgentFeedback: data.urgentFeedback
    });
  } catch (error) {
    console.error('[BRIEFING] Error fetching metrics:', error.message);
    res.status(500).json({ error: 'Failed to fetch briefing metrics' });
  }
});

module.exports = router;
