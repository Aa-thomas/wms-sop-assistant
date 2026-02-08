-- Feedback Learning Loop Migration
-- Run: PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/migrate_feedback_loop.sql

-- Full Q&A interaction log
CREATE TABLE IF NOT EXISTS interactions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  module TEXT,
  answer JSONB NOT NULL,
  chunk_ids TEXT[],
  similarity_scores REAL[],
  question_embedding vector(1536),
  helpful BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verified good Q&A pairs
CREATE TABLE IF NOT EXISTS golden_answers (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  question_embedding vector(1536) NOT NULL,
  answer JSONB NOT NULL,
  module TEXT,
  source TEXT DEFAULT 'thumbs_up',
  interaction_id INT REFERENCES interactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_golden_embedding
  ON golden_answers USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 10);

-- Verify
SELECT 'Migration complete. New tables:' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('interactions', 'golden_answers')
ORDER BY table_name;
