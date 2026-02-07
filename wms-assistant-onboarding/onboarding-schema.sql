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

-- Navigation module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Navigation', 1, 'Logging In & Launching the WMS', 'Learn how to access the WMS portal and log in',
 ARRAY['login', 'launch WMS', 'WMS portal'],
 'What are the steps to log in and launch the WMS?'),

('Navigation', 2, 'Portal Layout & Menu Navigation', 'Understand the main portal areas and how to use the menu bar',
 ARRAY['portal', 'menu bar', 'main portal navigation'],
 'What are the main areas of the WMS portal?'),

('Navigation', 3, 'Search & Resource Views', 'Learn how to search for records and use resource views effectively',
 ARRAY['search bar', 'resource view', 'search criteria', 'resource codes'],
 'How do you search for a specific record in the WMS?'),

('Navigation', 4, 'Hot Keys & Personalizing Views', 'Speed up your work with hot keys and customize your business views',
 ARRAY['hot keys', 'personalize', 'business view', 'bookmarks'],
 'What hot keys can you use to work faster in the WMS?');

-- Replenishment module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Replenishment', 1, 'System-Directed Replenishment', 'Learn how the system automatically directs replenishment tasks to your mobile device',
 ARRAY['system directed replenishment', 'replenishment mobile', 'replenishment task'],
 'How does system-directed replenishment work on your mobile device?'),

('Replenishment', 2, 'Replenish by Section & Area', 'Manually trigger replenishment for a specific section or area',
 ARRAY['replenish by section', 'replenish by area', 'section replenishment'],
 'When would you use replenish by section vs replenish by area?'),

('Replenishment', 3, 'Replenish by Location', 'Target a specific location for replenishment',
 ARRAY['replenish by location', 'location replenishment', 'specific location'],
 'How do you replenish a specific location?'),

('Replenishment', 4, 'Wave Replenishment Management', 'Use the desktop to manage wave-based replenishment',
 ARRAY['wave replenishment', 'replenishment management', 'desktop replenishment'],
 'What is wave replenishment and how do you manage it from the desktop?');

-- Returns module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Returns', 1, 'Return Authorization & Prerequisites', 'Understand the RMA requirement and prerequisites before processing a return',
 ARRAY['customer return', 'RMA', 'return authorization', 'prerequisite'],
 'What must be in place before you can process a customer return?'),

('Returns', 2, 'Inbound Return Planning', 'Create and plan an inbound return order',
 ARRAY['inbound return planning', 'return order', 'plan return'],
 'What are the steps to plan an inbound return?'),

('Returns', 3, 'Receiving a Return', 'Receive returned items including serial numbers and partial receipts',
 ARRAY['return receiving', 'receive return', 'serial number return', 'partial receipt'],
 'How do you receive a customer return, and what do you do with serial-numbered items?');

-- CycleCounts module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('CycleCounts', 1, 'Creating a Planned Cycle Count', 'Learn how to create cycle count tasks and assign them',
 ARRAY['planned cycle count', 'create cycle count', 'cycle count task'],
 'How do you create a planned cycle count?'),

('CycleCounts', 2, 'System-Directed Cycle Count', 'Perform a cycle count directed by the system on your mobile device',
 ARRAY['system directed cycle count', 'mobile cycle count', 'cycle count mobile'],
 'How does a system-directed cycle count work on the mobile device?'),

('CycleCounts', 3, 'Cycle Count by Order', 'Count inventory for a specific order',
 ARRAY['cycle count by order', 'count by order', 'order cycle count'],
 'When would you use cycle count by order?'),

('CycleCounts', 4, 'Demand Cycle Count', 'Handle on-demand cycle counts triggered by discrepancies',
 ARRAY['demand cycle count', 'on demand count', 'discrepancy count'],
 'What triggers a demand cycle count?'),

('CycleCounts', 5, 'Cycle Count Exceptions & Approval', 'Review and approve cycle count results and handle exceptions',
 ARRAY['cycle count exception', 'cycle count approval', 'count exception'],
 'How do you handle exceptions found during a cycle count?');

-- Inventory module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Inventory', 1, 'Store & Put-Away', 'Learn how to store received items in their designated locations',
 ARRAY['store', 'putaway', 'put-away', 'inventory store'],
 'What are the steps to put away inventory into a location?'),

('Inventory', 2, 'Inventory Move & Relocation', 'Move inventory between locations or relocate items',
 ARRAY['inventory move', 'relocation', 'move inventory', 'inventory relocation'],
 'What is the difference between an inventory move and a relocation?'),

('Inventory', 3, 'Inventory Adjustments', 'Adjust inventory quantities when discrepancies are found',
 ARRAY['inventory adjustment', 'quantity adjustment', 'adjust inventory'],
 'When and how do you make an inventory adjustment?'),

('Inventory', 4, 'Inventory Status Modification', 'Change the status of inventory (hold, release, damage)',
 ARRAY['inventory status', 'status modification', 'hold inventory', 'inventory hold'],
 'How do you change the status of inventory in the WMS?'),

('Inventory', 5, 'Item UOM & Volumetrics', 'Understand unit of measure and volumetric data for items',
 ARRAY['item UOM', 'unit of measure', 'volumetrics', 'item maintenance'],
 'Why is it important to have correct UOM and volumetric data?');

-- Admin module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Admin', 1, 'WMS User Management', 'Learn how to create, modify, and manage WMS users',
 ARRAY['WMS user', 'create user', 'user management', 'modify user'],
 'How do you create a new WMS user?'),

('Admin', 2, 'Warehouse Setup Overview', 'Understand the core warehouse configuration options',
 ARRAY['warehouse setup', 'warehouse options', 'warehouse configuration'],
 'What are the key settings in warehouse setup?'),

('Admin', 3, 'Hold Codes & Container Types', 'Configure hold codes and container selection codes',
 ARRAY['hold codes', 'container types', 'container selection', 'hold code configuration'],
 'What are hold codes used for in the WMS?'),

('Admin', 4, 'Areas & Picking Sections', 'Set up warehouse areas and picking section configuration',
 ARRAY['warehouse areas', 'picking section', 'area configuration', 'section setup'],
 'How are warehouse areas and picking sections configured?'),

('Admin', 5, 'Item Load & Label Management', 'Manage item loads, UOM settings, and label configurations',
 ARRAY['item load', 'item label', 'UOM load', 'label master'],
 'What is the item load process and why is it important?');

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
