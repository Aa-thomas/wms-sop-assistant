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

-- Metadata indexes for filtering
CREATE INDEX IF NOT EXISTS idx_module ON chunks(module);
CREATE INDEX IF NOT EXISTS idx_doc_title ON chunks(doc_title);

-- Verify
SELECT 'Schema ready. Tables:' AS status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
