-- Migration: Add module assignments for role-based access
-- Run: psql -f scripts/migrate_module_assignments.sql $DATABASE_URL

CREATE TABLE IF NOT EXISTS module_assignments (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('operator', 'supervisor')),
  module TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id),
  UNIQUE(role, module)
);

CREATE INDEX IF NOT EXISTS idx_module_assignments_role ON module_assignments(role);

-- Seed with all modules enabled by default for both roles
INSERT INTO module_assignments (role, module, enabled) VALUES
  ('operator', 'Navigation', true),
  ('operator', 'Inbound', true),
  ('operator', 'Outbound', true),
  ('operator', 'Picking', true),
  ('operator', 'Replenishment', true),
  ('operator', 'Inventory', true),
  ('operator', 'CycleCounts', true),
  ('operator', 'Returns', true),
  ('operator', 'Admin', true),
  ('supervisor', 'Navigation', true),
  ('supervisor', 'Inbound', true),
  ('supervisor', 'Outbound', true),
  ('supervisor', 'Picking', true),
  ('supervisor', 'Replenishment', true),
  ('supervisor', 'Inventory', true),
  ('supervisor', 'CycleCounts', true),
  ('supervisor', 'Returns', true),
  ('supervisor', 'Admin', true)
ON CONFLICT (role, module) DO NOTHING;

SELECT 'module_assignments migration complete' AS status;
