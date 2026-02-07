-- Onboarding v2 Schema: Quiz Validation + Supervisor Dashboard
-- Run: PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/onboarding_v2_schema.sql

-- Quiz attempts table
CREATE TABLE IF NOT EXISTS onboarding_quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  module TEXT NOT NULL,
  step_number INT NOT NULL,
  question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  feedback TEXT,
  attempt_number INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON onboarding_quiz_attempts(user_id, module);

-- Supervisor dashboard view
CREATE OR REPLACE VIEW supervisor_onboarding_dashboard AS
SELECT
  p.user_id,
  p.module,
  p.started_at,
  p.completed_at,
  COALESCE(array_length(p.completed_steps, 1), 0) as steps_completed,
  (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
  ROUND(
    COALESCE(array_length(p.completed_steps, 1), 0)::NUMERIC /
    NULLIF((SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module), 0) * 100,
    1
  ) as completion_percentage,
  p.last_activity,
  CASE
    WHEN p.completed_at IS NOT NULL THEN 'Completed'
    WHEN p.last_activity < NOW() - INTERVAL '7 days' THEN 'Stalled'
    WHEN p.last_activity > NOW() - INTERVAL '1 day' THEN 'Active'
    ELSE 'In Progress'
  END as status
FROM onboarding_progress p
ORDER BY p.last_activity DESC;

-- Module summary function
CREATE OR REPLACE FUNCTION get_module_summary(p_module TEXT DEFAULT NULL)
RETURNS TABLE (
  module TEXT,
  total_users INT,
  completed_users INT,
  in_progress_users INT,
  stalled_users INT,
  avg_completion_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.module,
    COUNT(DISTINCT d.user_id)::INT as total_users,
    COUNT(DISTINCT d.user_id) FILTER (WHERE d.completed_at IS NOT NULL)::INT as completed_users,
    COUNT(DISTINCT d.user_id) FILTER (WHERE d.completed_at IS NULL AND d.last_activity > NOW() - INTERVAL '7 days')::INT as in_progress_users,
    COUNT(DISTINCT d.user_id) FILTER (WHERE d.completed_at IS NULL AND d.last_activity < NOW() - INTERVAL '7 days')::INT as stalled_users,
    ROUND(AVG(EXTRACT(EPOCH FROM (d.completed_at - d.started_at))/86400), 1) as avg_completion_days
  FROM supervisor_onboarding_dashboard d
  WHERE p_module IS NULL OR d.module = p_module
  GROUP BY d.module
  ORDER BY total_users DESC;
END;
$$ LANGUAGE plpgsql;

-- Verify
SELECT 'onboarding_v2_schema applied' AS status;
\d onboarding_quiz_attempts
