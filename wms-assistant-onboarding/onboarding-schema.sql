-- Onboarding Feature - Database Schema

-- Onboarding curriculum (pre-defined learning paths per module)
CREATE TABLE onboarding_curriculum (
  id SERIAL PRIMARY KEY,
  module TEXT NOT NULL,
  step_number INT NOT NULL,
  step_title TEXT NOT NULL,
  step_description TEXT,
  search_queries TEXT[], -- queries to retrieve relevant chunks
  checkpoint_question TEXT, -- "Can you explain what to do for a short pick?"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module, step_number)
);

-- User progress tracking
CREATE TABLE onboarding_progress (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL, -- session ID or username
  module TEXT NOT NULL,
  current_step INT DEFAULT 1,
  completed_steps INT[], -- array of completed step numbers
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, module)
);

-- Indexes
CREATE INDEX idx_progress_user ON onboarding_progress(user_id);
CREATE INDEX idx_progress_module ON onboarding_progress(module);
CREATE INDEX idx_curriculum_module ON onboarding_curriculum(module);

-- Sample curriculum for Picking module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Picking', 1, 'Navigation & RF Gun Basics', 'Learn how to navigate the WMS and use your RF gun', 
 ARRAY['RF gun', 'navigation', 'picking screen'], 
 'Can you describe how to access the Picking screen?'),
 
('Picking', 2, 'Batch Picking Workflow', 'Understand the step-by-step batch picking process',
 ARRAY['batch picking', 'picking workflow', 'pick order'],
 'What are the main steps in batch picking?'),
 
('Picking', 3, 'Short Pick Handling', 'Learn what to do when items are not available',
 ARRAY['short pick', 'partial pick', 'item not found'],
 'What do you do if you encounter a short pick?'),
 
('Picking', 4, 'Inventory Discrepancies', 'Handle quantity mismatches and location issues',
 ARRAY['inventory discrepancy', 'quantity mismatch', 'wrong location'],
 'How do you handle an inventory discrepancy?'),
 
('Picking', 5, 'End-of-Shift Procedures', 'Complete your shift correctly',
 ARRAY['end of shift', 'close batch', 'shift completion'],
 'What are the key steps to complete at end of shift?');

-- Sample curriculum for Outbound module  
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Outbound', 1, 'Outbound Order Basics', 'Understanding outbound order processing',
 ARRAY['outbound order', 'order processing', 'order allocation'],
 'What is the first step in processing an outbound order?'),
 
('Outbound', 2, 'Order Allocation', 'Learn how orders are allocated to pickers',
 ARRAY['order allocation', 'allocation screen', 'assign order'],
 'How do you allocate an order?'),
 
('Outbound', 3, 'Packing Process', 'Pack orders correctly for shipment',
 ARRAY['packing', 'pack order', 'packing station'],
 'What are the steps to pack an order?'),
 
('Outbound', 4, 'Shipping Label Generation', 'Generate and apply shipping labels',
 ARRAY['shipping label', 'generate label', 'print label'],
 'How do you generate a shipping label?');

-- Sample curriculum for Inbound module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Inbound', 1, 'Receiving Overview', 'Learn the inbound receiving process',
 ARRAY['receiving', 'inbound order', 'receive shipment'],
 'What is the first step when receiving an inbound shipment?'),
 
('Inbound', 2, 'Quantity Verification', 'Verify quantities match the PO',
 ARRAY['quantity verification', 'count items', 'verify PO'],
 'What do you do if quantities don''t match the PO?'),
 
('Inbound', 3, 'Quality Inspection', 'Check for damaged or defective items',
 ARRAY['quality inspection', 'damaged goods', 'defective items'],
 'How do you handle damaged items during receiving?'),
 
('Inbound', 4, 'Put-Away Process', 'Store items in correct locations',
 ARRAY['put-away', 'store items', 'inventory location'],
 'What are the steps for putting away received items?');

-- Function to get next step for a user
CREATE OR REPLACE FUNCTION get_next_onboarding_step(p_user_id TEXT, p_module TEXT)
RETURNS TABLE (
  step_number INT,
  step_title TEXT,
  step_description TEXT,
  search_queries TEXT[],
  checkpoint_question TEXT,
  total_steps INT,
  completed_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.step_number,
    c.step_title,
    c.step_description,
    c.search_queries,
    c.checkpoint_question,
    (SELECT COUNT(*) FROM onboarding_curriculum WHERE module = p_module)::INT as total_steps,
    COALESCE(array_length(p.completed_steps, 1), 0)::INT as completed_count
  FROM onboarding_curriculum c
  LEFT JOIN onboarding_progress p ON p.user_id = p_user_id AND p.module = p_module
  WHERE c.module = p_module
    AND c.step_number = COALESCE(p.current_step, 1)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
