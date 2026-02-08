const db = require('./db');
const { generate } = require('./generate');

/**
 * Aggregate all data sources for the daily briefing
 */
async function aggregateBriefingData() {
  const data = {};

  // 1. Team Health Summary
  try {
    const healthResult = await db.query('SELECT * FROM get_team_strength_overview()');
    data.teamHealth = healthResult.rows[0] || null;
  } catch (err) {
    console.error('[BRIEFING] Team health query failed:', err.message);
    data.teamHealth = null;
  }

  // 2. Onboarding Status
  try {
    const onboardingResult = await db.query(`
      SELECT
        COUNT(DISTINCT user_id) AS total_users_onboarding,
        COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed_modules,
        COUNT(*) FILTER (WHERE completed_at IS NULL AND last_activity < NOW() - INTERVAL '7 days') AS stalled_modules,
        COUNT(*) FILTER (WHERE completed_at IS NULL AND last_activity >= NOW() - INTERVAL '7 days') AS active_modules
      FROM onboarding_progress
    `);
    data.onboarding = onboardingResult.rows[0];
  } catch (err) {
    console.error('[BRIEFING] Onboarding query failed:', err.message);
    data.onboarding = null;
  }

  // 3. Knowledge Gaps
  try {
    const gapsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS open_gaps,
        COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high') AS high_severity_gaps,
        COUNT(*) FILTER (WHERE status = 'open' AND severity = 'medium') AS medium_severity_gaps,
        (SELECT title FROM knowledge_gaps WHERE status = 'open' ORDER BY 
          CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, 
          question_count DESC LIMIT 1) AS top_gap_title
      FROM knowledge_gaps
    `);
    data.knowledgeGaps = gapsResult.rows[0];
  } catch (err) {
    console.error('[BRIEFING] Knowledge gaps query failed:', err.message);
    data.knowledgeGaps = null;
  }

  // 4. Pick Errors (last 7 days)
  try {
    const errorsResult = await db.query(`
      SELECT
        COUNT(*) AS total_errors_7d,
        COUNT(DISTINCT user_id) AS users_with_errors,
        ROUND(AVG(ABS(quantity_variance))::numeric, 1) AS avg_variance,
        (SELECT user_id FROM pick_errors 
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_error_user
      FROM pick_errors
      WHERE created_at > NOW() - INTERVAL '7 days'
    `);
    data.pickErrors = errorsResult.rows[0];
  } catch (err) {
    console.error('[BRIEFING] Pick errors query failed:', err.message);
    data.pickErrors = null;
  }

  // 5. Anonymous Feedback
  try {
    const feedbackResult = await db.query('SELECT * FROM feedback_summary');
    data.feedback = feedbackResult.rows[0];
    
    // Get recent high-urgency or complaint items
    const urgentFeedback = await db.query(`
      SELECT type, category, message, urgency, created_at
      FROM anonymous_feedback
      WHERE status = 'new' AND (urgency = 'high' OR type = 'complaint')
      ORDER BY created_at DESC
      LIMIT 3
    `);
    data.urgentFeedback = urgentFeedback.rows;
  } catch (err) {
    console.error('[BRIEFING] Feedback query failed:', err.message);
    data.feedback = null;
    data.urgentFeedback = [];
  }

  return data;
}

/**
 * Build the AI prompt for generating briefing insights
 */
function buildBriefingPrompt(data) {
  const sections = [];

  sections.push(`You are a warehouse operations assistant helping supervisors with their daily briefing.
Based on the following data, provide:
1. A brief 2-3 sentence summary of the team's current state
2. A list of 3-5 priority items that need attention today (most urgent first)
3. 2-3 specific, actionable suggestions for the supervisor

Be concise and actionable. Focus on issues that need immediate attention.`);

  sections.push('\n--- TEAM HEALTH DATA ---');
  if (data.teamHealth) {
    sections.push(`Total users: ${data.teamHealth.total_users || 0}`);
    sections.push(`Healthy: ${data.teamHealth.healthy_count || 0}, Needs attention: ${data.teamHealth.needs_attention_count || 0}, At risk: ${data.teamHealth.at_risk_count || 0}`);
    if (data.teamHealth.weakest_modules?.length > 0) {
      sections.push(`Weakest modules: ${data.teamHealth.weakest_modules.map(m => m.module).join(', ')}`);
    }
  } else {
    sections.push('No team health data available.');
  }

  sections.push('\n--- ONBOARDING STATUS ---');
  if (data.onboarding) {
    sections.push(`Active onboarding: ${data.onboarding.active_modules || 0} modules in progress`);
    sections.push(`Stalled (>7 days inactive): ${data.onboarding.stalled_modules || 0} modules`);
    sections.push(`Completed: ${data.onboarding.completed_modules || 0} modules`);
  }

  sections.push('\n--- KNOWLEDGE GAPS ---');
  if (data.knowledgeGaps) {
    sections.push(`Open gaps: ${data.knowledgeGaps.open_gaps || 0} (${data.knowledgeGaps.high_severity_gaps || 0} high severity)`);
    if (data.knowledgeGaps.top_gap_title) {
      sections.push(`Top gap: "${data.knowledgeGaps.top_gap_title}"`);
    }
  }

  sections.push('\n--- PICK ERRORS (Last 7 Days) ---');
  if (data.pickErrors) {
    sections.push(`Total errors: ${data.pickErrors.total_errors_7d || 0}`);
    sections.push(`Users with errors: ${data.pickErrors.users_with_errors || 0}`);
    if (data.pickErrors.top_error_user) {
      sections.push(`Most errors from user: ${data.pickErrors.top_error_user}`);
    }
  }

  sections.push('\n--- ANONYMOUS FEEDBACK ---');
  if (data.feedback) {
    sections.push(`New feedback: ${data.feedback.new_count || 0} items (${data.feedback.high_urgency_new || 0} high urgency)`);
    sections.push(`New complaints: ${data.feedback.new_complaints || 0}, New suggestions: ${data.feedback.new_suggestions || 0}`);
  }
  if (data.urgentFeedback?.length > 0) {
    sections.push('Recent urgent/complaint items:');
    data.urgentFeedback.forEach((f, i) => {
      sections.push(`  ${i + 1}. [${f.type}/${f.category}] "${f.message.substring(0, 100)}${f.message.length > 100 ? '...' : ''}"`);
    });
  }

  sections.push(`\nRespond in JSON format:
{
  "summary": "Brief 2-3 sentence overview...",
  "priorities": [
    { "title": "...", "description": "...", "urgency": "high|medium|low", "tab": "health|onboarding|gaps|errors|feedback" }
  ],
  "suggestions": [
    { "action": "...", "reason": "..." }
  ]
}`);

  return sections.join('\n');
}

/**
 * Generate the daily briefing with AI insights
 */
async function generateDailyBriefing() {
  const data = await aggregateBriefingData();
  const prompt = buildBriefingPrompt(data);

  let aiInsights = null;
  try {
    console.log('[BRIEFING] Calling AI with prompt length:', prompt.length);
    aiInsights = await generate(prompt);
    console.log('[BRIEFING] AI response received:', aiInsights ? 'success' : 'null');
  } catch (err) {
    console.error('[BRIEFING] AI generation failed:', err.message);
    console.error('[BRIEFING] Full error:', err);
  }

  return {
    generated_at: new Date().toISOString(),
    metrics: {
      teamHealth: data.teamHealth,
      onboarding: data.onboarding,
      knowledgeGaps: data.knowledgeGaps,
      pickErrors: data.pickErrors,
      feedback: data.feedback
    },
    urgentFeedback: data.urgentFeedback,
    insights: aiInsights
  };
}

module.exports = {
  aggregateBriefingData,
  buildBriefingPrompt,
  generateDailyBriefing
};
