-- WMS SOP Assistant - Database Schema
-- Run: PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/init_db.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main chunks table
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  embedding vector(1536),
  doc_title TEXT NOT NULL,
  module TEXT NOT NULL,
  procedure TEXT,
  slide_number INT NOT NULL,
  source_locator TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  question TEXT,
  response_id TEXT,
  helpful BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Metadata indexes for filtering
CREATE INDEX IF NOT EXISTS idx_module ON chunks(module);
CREATE INDEX IF NOT EXISTS idx_doc_title ON chunks(doc_title);

CREATE INDEX IF NOT EXISTS idx_golden_embedding
  ON golden_answers USING ivfflat (question_embedding vector_cosine_ops) WITH (lists = 10);

-- Verify
SELECT 'Schema ready. Tables:' AS status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
