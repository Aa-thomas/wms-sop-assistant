const db = require('./db');
const { generate } = require('./generate');

/**
 * Aggregate all personal data for an operator's briefing
 */
async function aggregateOperatorData(userId) {
  const data = { userId };

  // 1. Personal Health from user_learning_health view
  try {
    const healthResult = await db.query(
      'SELECT * FROM user_learning_health WHERE user_id::text = $1',
      [userId]
    );
    data.health = healthResult.rows[0] || null;
  } catch (err) {
    console.error('[OP-BRIEFING] Health query failed:', err.message);
    data.health = null;
  }

  // 2. Personal Weaknesses
  try {
    const weaknessResult = await db.query(
      'SELECT * FROM user_knowledge_weaknesses WHERE user_id = $1',
      [userId]
    );
    data.weaknesses = weaknessResult.rows;
  } catch (err) {
    console.error('[OP-BRIEFING] Weaknesses query failed:', err.message);
    data.weaknesses = [];
  }

  // 3. Onboarding Progress
  try {
    const onboardingResult = await db.query(
      `SELECT
        p.module,
        p.current_step,
        COALESCE(array_length(p.completed_steps, 1), 0) as completed_count,
        (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
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
       ORDER BY p.last_activity DESC`,
      [userId]
    );
    data.onboarding = onboardingResult.rows;
  } catch (err) {
    console.error('[OP-BRIEFING] Onboarding query failed:', err.message);
    data.onboarding = [];
  }

  // 4. Pick Errors (last 90 days)
  try {
    const errorsResult = await db.query(
      `SELECT
        COUNT(*)::int AS total_errors,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS errors_7d,
        ROUND(AVG(ABS(quantity_variance))::numeric, 1) AS avg_variance,
        MAX(created_at) AS last_error
       FROM pick_errors
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'`,
      [userId]
    );
    data.pickErrors = errorsResult.rows[0];
  } catch (err) {
    console.error('[OP-BRIEFING] Pick errors query failed:', err.message);
    data.pickErrors = null;
  }

  // 5. Recent quiz performance
  try {
    const quizResult = await db.query(
      `SELECT
        COUNT(*) AS total_attempts,
        COUNT(*) FILTER (WHERE is_correct) AS correct_attempts,
        ROUND(AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100)::int AS success_rate
       FROM onboarding_quiz_attempts
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );
    data.recentQuiz = quizResult.rows[0];
  } catch (err) {
    console.error('[OP-BRIEFING] Quiz query failed:', err.message);
    data.recentQuiz = null;
  }

  return data;
}

/**
 * Build personalized AI prompt for operator briefing
 */
function buildOperatorBriefingPrompt(data, username) {
  const sections = [];

  sections.push(`You are a supportive warehouse operations coach helping an individual operator improve their performance.
Generate a personalized briefing for ${username} that:
1. Provides a brief 2-3 sentence summary of their current standing (encouraging tone)
2. Lists 2-4 specific, actionable tips they can work on today
3. Includes an encouraging message highlighting their progress or strengths

Be warm, supportive, and constructive. Focus on growth and improvement, not criticism.`);

  sections.push('\n--- HEALTH STATUS ---');
  if (data.health) {
    sections.push(`Overall health: ${data.health.health_status || 'unknown'}`);
    sections.push(`Modules: ${data.health.modules_completed || 0} completed, ${data.health.modules_active || 0} active, ${data.health.modules_stalled || 0} stalled`);
    sections.push(`Quiz success rate: ${data.health.quiz_correct_rate || 0}%`);
    sections.push(`Chat questions asked: ${data.health.chat_questions_asked || 0}`);
  } else {
    sections.push('New user - no historical data yet.');
  }

  sections.push('\n--- ONBOARDING PROGRESS ---');
  if (data.onboarding?.length > 0) {
    data.onboarding.forEach(m => {
      const progress = m.total_steps > 0 ? Math.round((m.completed_count / m.total_steps) * 100) : 0;
      sections.push(`- ${m.module}: ${m.completed_count}/${m.total_steps} steps (${progress}%) - ${m.status}`);
    });
  } else {
    sections.push('No onboarding modules started yet.');
  }

  sections.push('\n--- KNOWLEDGE WEAKNESSES ---');
  if (data.weaknesses?.length > 0) {
    const quizFailures = data.weaknesses.filter(w => w.weakness_type === 'quiz_failure');
    const stalledModules = data.weaknesses.filter(w => w.weakness_type === 'stalled_module');
    if (quizFailures.length > 0) {
      sections.push(`Quiz struggles: ${quizFailures.map(w => `${w.module} step ${w.step_number}`).join(', ')}`);
    }
    if (stalledModules.length > 0) {
      sections.push(`Stalled modules: ${stalledModules.map(w => `${w.module} (${w.detail})`).join(', ')}`);
    }
  } else {
    sections.push('No identified weaknesses - great job!');
  }

  sections.push('\n--- PICK ERRORS (Last 90 days) ---');
  if (data.pickErrors) {
    sections.push(`Total errors: ${data.pickErrors.total_errors || 0}`);
    sections.push(`Errors this week: ${data.pickErrors.errors_7d || 0}`);
    if (data.pickErrors.avg_variance) {
      sections.push(`Average variance: ${data.pickErrors.avg_variance} units`);
    }
  } else {
    sections.push('No pick errors recorded - excellent!');
  }

  sections.push(`\nRespond in JSON format:
{
  "summary": "Brief 2-3 sentence personalized summary...",
  "tips": [
    { "title": "Short action title", "description": "Specific actionable advice", "priority": "high|medium|low" }
  ],
  "encouragement": "Positive, motivating message highlighting strengths or progress..."
}`);

  return sections.join('\n');
}

/**
 * Generate the personalized operator briefing
 */
async function generateOperatorBriefing(userId, username) {
  const data = await aggregateOperatorData(userId);
  const prompt = buildOperatorBriefingPrompt(data, username);

  let insights = null;
  try {
    console.log('[OP-BRIEFING] Generating insights for user:', userId);
    insights = await generate(prompt);
  } catch (err) {
    console.error('[OP-BRIEFING] AI generation failed:', err.message);
  }

  // Calculate summary metrics
  const modulesCompleted = data.onboarding?.filter(m => m.status === 'completed').length || 0;
  const modulesActive = data.onboarding?.filter(m => m.status === 'active').length || 0;
  const modulesStalled = data.onboarding?.filter(m => m.status === 'stalled').length || 0;

  return {
    generated_at: new Date().toISOString(),
    user: { id: userId, username },
    metrics: {
      health_status: data.health?.health_status || 'unknown',
      modules_completed: modulesCompleted,
      modules_active: modulesActive,
      modules_stalled: modulesStalled,
      modules_total: data.onboarding?.length || 0,
      quiz_correct_rate: data.health?.quiz_correct_rate || 0,
      pick_errors_7d: data.pickErrors?.errors_7d || 0,
      pick_errors_total: data.pickErrors?.total_errors || 0
    },
    insights
  };
}

module.exports = {
  aggregateOperatorData,
  generateOperatorBriefing
};
