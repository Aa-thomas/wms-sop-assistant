-- Migration: Add embedding support to anonymous feedback for gap analysis
-- Run: PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/migrate_feedback_embeddings.sql

-- Add embedding column for semantic clustering in gap analysis
ALTER TABLE anonymous_feedback 
ADD COLUMN IF NOT EXISTS message_embedding vector(1536);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS idx_feedback_embedding ON anonymous_feedback 
USING ivfflat (message_embedding vector_cosine_ops) WITH (lists = 100);

-- Add column to track if feedback has been processed for gap analysis
ALTER TABLE anonymous_feedback
ADD COLUMN IF NOT EXISTS gap_processed BOOLEAN DEFAULT FALSE;

SELECT 'Feedback embedding columns added.' AS status;
