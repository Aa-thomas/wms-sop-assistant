CREATE TABLE IF NOT EXISTS pick_errors (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  pps_number TEXT NOT NULL,
  shipment_number TEXT NOT NULL,
  item TEXT NOT NULL,
  quantity_variance INT NOT NULL,
  notes TEXT,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pick_errors_user ON pick_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_pick_errors_created ON pick_errors(created_at);
