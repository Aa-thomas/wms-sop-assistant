-- Gap Analysis Migration
-- Run: PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/migrate_gap_analysis.sql

CREATE TABLE IF NOT EXISTS gap_analysis_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_interactions INT,
  gaps_found INT,
  status TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS knowledge_gaps (
  id SERIAL PRIMARY KEY,
  run_id INT REFERENCES gap_analysis_runs(id),
  title TEXT NOT NULL,
  description TEXT,
  sample_questions TEXT[] NOT NULL,
  question_count INT NOT NULL,
  suggested_module TEXT,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  sop_draft TEXT,
  sop_draft_generated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT 'Gap analysis tables created.' AS status;
