-- Migration: Anonymous Feedback System
-- Run: PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/migrate_anonymous_feedback.sql

-- Anonymous feedback table (no user_id to ensure anonymity)
CREATE TABLE IF NOT EXISTS anonymous_feedback (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('complaint', 'suggestion', 'feedback')),
  category TEXT CHECK (category IN ('workflow', 'safety', 'equipment', 'training', 'management', 'other')),
  message TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed')),
  supervisor_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_feedback_status ON anonymous_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON anonymous_feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON anonymous_feedback(urgency);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON anonymous_feedback(created_at DESC);

-- Summary view for dashboard/briefing
CREATE OR REPLACE VIEW feedback_summary AS
SELECT
  COUNT(*) FILTER (WHERE status = 'new') AS new_count,
  COUNT(*) FILTER (WHERE status = 'reviewed') AS reviewed_count,
  COUNT(*) FILTER (WHERE status = 'actioned') AS actioned_count,
  COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed_count,
  COUNT(*) FILTER (WHERE urgency = 'high' AND status = 'new') AS high_urgency_new,
  COUNT(*) FILTER (WHERE type = 'complaint' AND status = 'new') AS new_complaints,
  COUNT(*) FILTER (WHERE type = 'suggestion' AND status = 'new') AS new_suggestions,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7d
FROM anonymous_feedback;

SELECT 'Anonymous feedback table created.' AS status;
