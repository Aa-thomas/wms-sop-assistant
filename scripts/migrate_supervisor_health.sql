-- Migration: Supervisor Health Dashboard
-- Adds user_id tracking to interactions and creates views/functions for team health monitoring

-- 1a. Add user_id to interactions table
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_interactions_user ON interactions(user_id);

-- 1b. View: user_learning_health — per-user health summary
CREATE OR REPLACE VIEW user_learning_health AS
WITH user_modules AS (
  SELECT
    u.id,
    u.username,
    COUNT(CASE WHEN p.completed_at IS NOT NULL THEN 1 END) AS modules_completed,
    COUNT(CASE WHEN p.completed_at IS NULL AND p.last_activity < NOW() - INTERVAL '7 days' THEN 1 END) AS modules_stalled,
    COUNT(CASE WHEN p.completed_at IS NULL AND p.last_activity >= NOW() - INTERVAL '7 days' THEN 1 END) AS modules_active,
    COUNT(p.id) AS modules_started,
    MAX(p.last_activity) AS last_activity
  FROM users u
  LEFT JOIN onboarding_progress p ON u.id::TEXT = p.user_id
  WHERE u.is_supervisor = false
  GROUP BY u.id, u.username
),
user_quiz AS (
  SELECT
    q.user_id,
    ROUND(AVG(CASE WHEN q.is_correct THEN 1.0 ELSE 0.0 END) * 100) AS quiz_correct_rate,
    ROUND(AVG(q.attempt_number), 1) AS quiz_avg_attempts
  FROM onboarding_quiz_attempts q
  GROUP BY q.user_id
),
user_chat AS (
  SELECT
    i.user_id,
    COUNT(*) AS chat_questions_asked,
    COUNT(DISTINCT i.module) AS chat_modules_queried
  FROM interactions i
  WHERE i.user_id IS NOT NULL
  GROUP BY i.user_id
)
SELECT
  um.id AS user_id,
  um.username,
  um.modules_started,
  um.modules_completed,
  um.modules_stalled,
  um.modules_active,
  COALESCE(uq.quiz_correct_rate, 0) AS quiz_correct_rate,
  COALESCE(uq.quiz_avg_attempts, 0) AS quiz_avg_attempts,
  COALESCE(uc.chat_questions_asked, 0) AS chat_questions_asked,
  COALESCE(uc.chat_modules_queried, 0) AS chat_modules_queried,
  um.last_activity,
  CASE
    WHEN COALESCE(uq.quiz_correct_rate, 100) < 40
      OR um.modules_stalled >= 2
      OR (um.last_activity < NOW() - INTERVAL '14 days' AND um.modules_completed < um.modules_started)
      THEN 'at_risk'
    WHEN um.modules_stalled = 1
      OR (COALESCE(uq.quiz_correct_rate, 100) >= 40 AND COALESCE(uq.quiz_correct_rate, 100) < 70)
      THEN 'needs_attention'
    ELSE 'healthy'
  END AS health_status
FROM user_modules um
LEFT JOIN user_quiz uq ON um.id::TEXT = uq.user_id
LEFT JOIN user_chat uc ON um.id::TEXT = uc.user_id;

-- 1c. View: user_knowledge_weaknesses — per-user gap details
CREATE OR REPLACE VIEW user_knowledge_weaknesses AS
-- Quiz failures
SELECT
  q.user_id,
  'quiz_failure' AS weakness_type,
  q.module,
  q.step_number,
  q.question,
  COUNT(*) AS failure_count,
  BOOL_OR(q.is_correct) AS eventually_correct,
  NULL::TEXT AS detail
FROM onboarding_quiz_attempts q
WHERE q.is_correct = false
GROUP BY q.user_id, q.module, q.step_number, q.question

UNION ALL

-- Stalled modules
SELECT
  p.user_id,
  'stalled_module' AS weakness_type,
  p.module,
  NULL AS step_number,
  NULL AS question,
  NULL AS failure_count,
  NULL AS eventually_correct,
  EXTRACT(DAY FROM NOW() - p.last_activity)::TEXT || ' days inactive' AS detail
FROM onboarding_progress p
WHERE p.completed_at IS NULL
  AND p.last_activity < NOW() - INTERVAL '7 days'

UNION ALL

-- Not started modules (modules in curriculum but user hasn't begun)
SELECT
  u.id::TEXT AS user_id,
  'not_started' AS weakness_type,
  c.module,
  NULL AS step_number,
  NULL AS question,
  NULL AS failure_count,
  NULL AS eventually_correct,
  NULL AS detail
FROM users u
CROSS JOIN (SELECT DISTINCT module FROM onboarding_curriculum) c
LEFT JOIN onboarding_progress p ON u.id::TEXT = p.user_id AND c.module = p.module
WHERE u.is_supervisor = false
  AND p.id IS NULL;

-- 1d. Function: get_team_strength_overview() — team-level summary
CREATE OR REPLACE FUNCTION get_team_strength_overview()
RETURNS TABLE (
  total_users BIGINT,
  healthy_count BIGINT,
  needs_attention_count BIGINT,
  at_risk_count BIGINT,
  weakest_modules JSONB,
  users_needing_help JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH health AS (
    SELECT * FROM user_learning_health
  ),
  status_counts AS (
    SELECT
      COUNT(*) AS cnt_total,
      COUNT(*) FILTER (WHERE health_status = 'healthy') AS cnt_healthy,
      COUNT(*) FILTER (WHERE health_status = 'needs_attention') AS cnt_attention,
      COUNT(*) FILTER (WHERE health_status = 'at_risk') AS cnt_risk
    FROM health
  ),
  module_completion AS (
    SELECT
      c.module,
      COUNT(DISTINCT CASE WHEN p.completed_at IS NOT NULL THEN p.user_id END) AS completed_users,
      COUNT(DISTINCT u.id) AS cnt_users
    FROM (SELECT DISTINCT module FROM onboarding_curriculum) c
    CROSS JOIN users u
    LEFT JOIN onboarding_progress p ON u.id::TEXT = p.user_id AND c.module = p.module
    WHERE u.is_supervisor = false
    GROUP BY c.module
    ORDER BY COUNT(DISTINCT CASE WHEN p.completed_at IS NOT NULL THEN p.user_id END)::FLOAT /
             NULLIF(COUNT(DISTINCT u.id), 0) ASC
    LIMIT 3
  ),
  weak_modules AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'module', mc.module,
      'completed_users', mc.completed_users,
      'total_users', mc.cnt_users
    )), '[]'::jsonb) AS weak_list
    FROM module_completion mc
  ),
  needing_help AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', h.user_id,
      'username', h.username,
      'health_status', h.health_status,
      'modules_completed', h.modules_completed,
      'modules_started', h.modules_started,
      'quiz_correct_rate', h.quiz_correct_rate,
      'modules_stalled', h.modules_stalled
    )), '[]'::jsonb) AS help_list
    FROM health h
    WHERE h.health_status != 'healthy'
  )
  SELECT
    sc.cnt_total,
    sc.cnt_healthy,
    sc.cnt_attention,
    sc.cnt_risk,
    wm.weak_list,
    nh.help_list
  FROM status_counts sc, weak_modules wm, needing_help nh;
END;
$$ LANGUAGE plpgsql;
