-- Fix: Create supervisor_onboarding_dashboard view that was missing from DB
-- This view was defined in onboarding_v2_schema.sql but never applied

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
