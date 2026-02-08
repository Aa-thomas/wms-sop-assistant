-- Migration: Make onboarding deterministic with explicit chunk_ids
-- Adds chunk_ids column, rewrites curriculum to match actual SOP sections,
-- and updates get_next_onboarding_step() to return chunk_ids instead of search_queries.

BEGIN;

-- 1. Add chunk_ids column
ALTER TABLE onboarding_curriculum ADD COLUMN IF NOT EXISTS chunk_ids TEXT[];

-- 2. Reset progress so users restart with new curriculum structure
-- (step numbers change, so old progress is invalid)
DELETE FROM onboarding_quiz_attempts;
DELETE FROM onboarding_progress;

-- 3. Delete old curriculum and insert new section-based curriculum
DELETE FROM onboarding_curriculum;

-- ============================================================
-- WAVES (slides 3-40 of Picking doc, own module)
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Waves', 1, 'Wave Building & Release',
 'Learn how to build, plan, and release outbound order waves for picking.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 3 AND 20 ORDER BY slide_number),
 'What are the three main stages of wave processing, and what status does the wave have after each stage?'),

('Waves', 2, 'Wave Management',
 'Learn how to cancel, suspend, and replan waves when changes are needed.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 21 AND 40 ORDER BY slide_number),
 'What is the difference between canceling and suspending a wave, and when would you use each?');

-- Enable Waves module for both roles
INSERT INTO module_assignments (role, module, enabled) VALUES
('operator', 'Waves', true),
('supervisor', 'Waves', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PICKING (slides 41-88 of Picking doc, mobile picking workflows)
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Picking', 1, 'Pick by Order',
 'Learn the mobile device workflow for picking products by outbound order.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 41 AND 52 ORDER BY slide_number),
 'Walk through the main steps of picking by order on a mobile device, from entering the order number to completing the pick.'),

('Picking', 2, 'Pick by Shipment',
 'Learn how to pick products grouped by shipment rather than individual order.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 53 AND 57 ORDER BY slide_number),
 'How does Pick by Shipment differ from Pick by Order, and when would you use it?'),

('Picking', 3, 'Cluster Picking',
 'Learn how to pick multiple orders simultaneously using clusters.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 58 AND 66 ORDER BY slide_number),
 'What is a picking cluster and how do you resume an incomplete cluster pick?'),

('Picking', 4, 'Container Pick Complete',
 'Learn the process for closing containers after picking is finished.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 67 AND 70 ORDER BY slide_number),
 'What happens when the system detects the final pick for a container, and what do you need to confirm?'),

('Picking', 5, 'Picking Exceptions',
 'Learn how to handle container full, partial picks, unavailable inventory, and not-required items.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 71 AND 77 ORDER BY slide_number),
 'Name the four picking exceptions and explain what action to take for each one.'),

('Picking', 6, 'Conventional Picking',
 'Learn the paper-based picking process used with desktop-generated pick lists.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Picking' AND slide_number BETWEEN 78 AND 88 ORDER BY slide_number),
 'What are the steps to complete a conventional pick using a paper-based pick list?');

-- ============================================================
-- INBOUND (41 slides, single doc "Inbound Order Process V3")
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Inbound', 1, 'Prerequisites & Receiver Tracker',
 'Learn the prerequisites for receiving and how to use the Receiver Tracker.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inbound' AND slide_number BETWEEN 3 AND 8 ORDER BY slide_number),
 'What should you check before starting the receiving process, and how do you look up a container in the Receiver Tracker?'),

('Inbound', 2, 'Receipt Schedules & Receiving',
 'Learn how to check receipt schedules and perform inbound order receiving on a mobile device.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inbound' AND slide_number BETWEEN 9 AND 22 ORDER BY slide_number),
 'Walk through the steps of receiving items on a mobile device, including what to do if quantities differ from the PO.'),

('Inbound', 3, 'Receipt Closeout',
 'Learn how to close out completed receipts at the end of the day.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inbound' AND slide_number BETWEEN 23 AND 26 ORDER BY slide_number),
 'When is Receipt Closeout performed, and what are the steps to complete it?'),

('Inbound', 4, 'Quality Check',
 'Learn how to route items to quality check and update their hold status.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inbound' AND slide_number BETWEEN 27 AND 33 ORDER BY slide_number),
 'How do you place a received item into Quality Check, and what information do you need to enter?'),

('Inbound', 5, 'Release for Putaway',
 'Learn how to release received items for storage in the warehouse.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inbound' AND slide_number BETWEEN 34 AND 37 ORDER BY slide_number),
 'What are the steps to release a tag for putaway using the mobile device?'),

('Inbound', 6, 'Basic Receiving',
 'Learn how to receive products without a purchase order using Basic Receiving.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inbound' AND slide_number BETWEEN 38 AND 41 ORDER BY slide_number),
 'When would you use Basic Receiving instead of regular receiving?');

-- ============================================================
-- OUTBOUND (81 slides, single doc "Outbound Order Process V3")
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Outbound', 1, 'Staging Table Summary',
 'Learn how to monitor and resolve staging table errors for outbound orders.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 3 AND 8 ORDER BY slide_number),
 'What is the Staging Table Summary used for, and how do you identify records with errors?'),

('Outbound', 2, 'Container Build & Merge',
 'Learn how to build containers and merge containers for the same shipment.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 9 AND 24 ORDER BY slide_number),
 'What is the difference between Container Build and Container Merge, and when would you use each?'),

('Outbound', 3, 'Shipment Edit',
 'Learn how to examine and modify shipment information.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 25 AND 29 ORDER BY slide_number),
 'What shipment fields can be modified through the Shipment Edit resource?'),

('Outbound', 4, 'Shipping Activities - Parcel & LTL',
 'Learn the shipping workflow for both parcel and LTL (Less Than Truckload) shipments.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 30 AND 47 ORDER BY slide_number),
 'Walk through the shipping activities for a parcel shipment, from accessing the resource to generating the TMS shipment.'),

('Outbound', 5, 'Manifest Generation',
 'Learn how to close carriers and generate shipping manifests.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 48 AND 54 ORDER BY slide_number),
 'What is a manifest and how do you generate one in the WMS?'),

('Outbound', 6, 'Shipment Completion',
 'Learn the final step of shipping: completing the shipment to remove inventory from the system.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 55 AND 62 ORDER BY slide_number),
 'What happens to inventory when a shipment is completed, and how often should shipment maintenance be done?'),

('Outbound', 7, 'Exception - Cancelled Order',
 'Learn the full process for handling a cancelled outbound order.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Outbound' AND slide_number BETWEEN 63 AND 81 ORDER BY slide_number),
 'List the main steps required to process a cancelled order, from voiding the TMS shipment to returning inventory.');

-- ============================================================
-- NAVIGATION (82 slides, single doc "Navigation V2")
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Navigation', 1, 'WMS Overview & Login',
 'Learn what the WMS is, how users interact with it, and how to log in.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Navigation' AND slide_number BETWEEN 3 AND 9 ORDER BY slide_number),
 'What are the two types of computers used to interact with the WMS, and what are the steps to log in?'),

('Navigation', 2, 'Portal Layout & Menu Navigation',
 'Learn the main areas of the WMS portal, menu structure, and how to access resources.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Navigation' AND slide_number BETWEEN 10 AND 19 ORDER BY slide_number),
 'What are the main areas of the WMS portal, and how do you navigate to a specific resource?'),

('Navigation', 3, 'Search Bar & Toolbox Panel',
 'Learn how to use the search bar with resource codes, and manage your toolbox panel and bookmarks.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Navigation' AND slide_number BETWEEN 20 AND 32 ORDER BY slide_number),
 'How do you use resource codes in the search bar, and how do you add or remove bookmarks?'),

('Navigation', 4, 'Resource Views & Search Criteria',
 'Learn how to use resource views, search criteria, criteria helpers, and auto-fill criteria sets.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Navigation' AND slide_number BETWEEN 33 AND 62 ORDER BY slide_number),
 'How do you create and use an auto-fill criteria set to speed up your searches?'),

('Navigation', 5, 'Hot Keys',
 'Learn the keyboard shortcuts available in the WMS for faster navigation.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Navigation' AND slide_number BETWEEN 63 AND 70 ORDER BY slide_number),
 'Name three hot keys and what actions they perform in the WMS.'),

('Navigation', 6, 'Personalizing Views',
 'Learn how to customize search criteria, results, and details views to fit your workflow.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Navigation' AND slide_number BETWEEN 71 AND 82 ORDER BY slide_number),
 'What three sections of a view can you personalize, and how do you access the personalization settings?');

-- ============================================================
-- CYCLE COUNTS (47 slides, single doc "Cycle Counts")
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('CycleCounts', 1, 'Planned Cycle Count Creation',
 'Learn how to create and release planned cycle counts from a desktop computer.',
 ARRAY(SELECT id FROM chunks WHERE module = 'CycleCounts' AND slide_number BETWEEN 3 AND 16 ORDER BY slide_number),
 'What are the three options for specifying which items or locations to include in a planned cycle count?'),

('CycleCounts', 2, 'System-Directed Cycle Count',
 'Learn how to perform system-directed cycle counts on a mobile device.',
 ARRAY(SELECT id FROM chunks WHERE module = 'CycleCounts' AND slide_number BETWEEN 17 AND 23 ORDER BY slide_number),
 'How does a system-directed cycle count work, and what do you do if your count differs from the system?'),

('CycleCounts', 3, 'Cycle Count by Order',
 'Learn how to perform a specific planned cycle count using an order ID.',
 ARRAY(SELECT id FROM chunks WHERE module = 'CycleCounts' AND slide_number BETWEEN 24 AND 27 ORDER BY slide_number),
 'When would you use Cycle Count by Order instead of system-directed cycle counting?'),

('CycleCounts', 4, 'Demand Cycle Count',
 'Learn how to initiate an on-demand cycle count for a specific location.',
 ARRAY(SELECT id FROM chunks WHERE module = 'CycleCounts' AND slide_number BETWEEN 28 AND 34 ORDER BY slide_number),
 'What triggers a demand cycle count, and how can you create inventory through the cycle count process?'),

('CycleCounts', 5, 'Cycle Count with Desktop',
 'Learn how to perform cycle counts using paper-based lists generated from a desktop computer.',
 ARRAY(SELECT id FROM chunks WHERE module = 'CycleCounts' AND slide_number BETWEEN 35 AND 43 ORDER BY slide_number),
 'Walk through the steps of completing a paper-based cycle count list on a desktop computer.'),

('CycleCounts', 6, 'Cycle Count Exceptions & Approval',
 'Learn how exceptions are handled and how supervisors approve cycle count results.',
 ARRAY(SELECT id FROM chunks WHERE module = 'CycleCounts' AND slide_number BETWEEN 44 AND 47 ORDER BY slide_number),
 'When is approval required for cycle count exceptions, and how does a supervisor approve them?');

-- ============================================================
-- REPLENISHMENT (25 slides, single doc "Replenishment")
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Replenishment', 1, 'System-Directed Replenishment',
 'Learn how to perform system-directed replenishment on a mobile device.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Replenishment' AND slide_number BETWEEN 3 AND 8 ORDER BY slide_number),
 'How does system-directed replenishment work, and what happens if a store command is assigned during replenishment?'),

('Replenishment', 2, 'Replenish by Section',
 'Learn how to replenish specific sections in the warehouse.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Replenishment' AND slide_number BETWEEN 9 AND 12 ORDER BY slide_number),
 'What options are available when setting up a replenishment by section?'),

('Replenishment', 3, 'Replenish by Area',
 'Learn how to replenish specific areas in the warehouse.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Replenishment' AND slide_number BETWEEN 13 AND 16 ORDER BY slide_number),
 'How does Replenish by Area differ from Replenish by Section?'),

('Replenishment', 4, 'Replenish by Location',
 'Learn how to replenish specific locations in the warehouse.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Replenishment' AND slide_number BETWEEN 17 AND 20 ORDER BY slide_number),
 'When would you use Replenish by Location instead of the other replenishment methods?'),

('Replenishment', 5, 'Wave Replenishment Management',
 'Learn how to create and manage replenishment waves from a desktop computer.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Replenishment' AND slide_number BETWEEN 21 AND 25 ORDER BY slide_number),
 'How do you create a replenishment wave from the desktop, and what criteria can you specify?');

-- ============================================================
-- RETURNS (19 slides, single doc "Customer Returns V3")
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Returns', 1, 'Prerequisites & RMA',
 'Learn what must be in place before processing a customer return.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Returns' AND slide_number BETWEEN 3 AND 4 ORDER BY slide_number),
 'What is an RMA and why is it required before processing a return?'),

('Returns', 2, 'Inbound Return Planning',
 'Learn how to plan an inbound return using the desktop.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Returns' AND slide_number BETWEEN 5 AND 8 ORDER BY slide_number),
 'What are the steps to plan an inbound return in the WMS?'),

('Returns', 3, 'Receiving a Return',
 'Learn how to receive customer returns on desktop and mobile, including serial-numbered items.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Returns' AND slide_number BETWEEN 9 AND 19 ORDER BY slide_number),
 'How do you receive a customer return, and what extra steps are needed for serial-numbered items?');

-- ============================================================
-- INVENTORY (multi-doc: Inv_Store-Move-Relocation-Adjustments_V1,
--            Inventory_Labor_Management_V1,
--            Tecsys_Inventory_Accuracy_Procedures)
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Inventory', 1, 'Store (Putaway)',
 'Learn how to store products to warehouse locations using a mobile device.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inv Store-Move-Relocation-Adjustments V1' AND slide_number BETWEEN 3 AND 9 ORDER BY slide_number),
 'What are the steps to store a product using the mobile device?'),

('Inventory', 2, 'Inventory Move',
 'Learn how to move inventory between locations.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inv Store-Move-Relocation-Adjustments V1' AND slide_number BETWEEN 10 AND 15 ORDER BY slide_number),
 'How do you move inventory to a different location, and can you move a partial quantity?'),

('Inventory', 3, 'Inventory Relocation',
 'Learn how to relocate inventory using a different method than Inventory Move.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inv Store-Move-Relocation-Adjustments V1' AND slide_number BETWEEN 16 AND 20 ORDER BY slide_number),
 'What is the difference between an Inventory Move and an Inventory Relocation?'),

('Inventory', 4, 'Inventory Adjustments',
 'Learn how to adjust inventory levels to match actual quantities.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inv Store-Move-Relocation-Adjustments V1' AND slide_number BETWEEN 21 AND 24 ORDER BY slide_number),
 'When and how do you make an inventory adjustment in the WMS?'),

('Inventory', 5, 'Inventory Status Modification',
 'Learn how to change inventory status, hold codes, and attributes.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inventory Labor Management V1' AND slide_number BETWEEN 26 AND 44 ORDER BY slide_number),
 'How do you change the status of inventory, and what fields can be modified?'),

('Inventory', 6, 'Item UOM & Volumetrics',
 'Learn how to maintain item units of measure and volumetric data.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inventory Labor Management V1' AND slide_number BETWEEN 3 AND 25 ORDER BY slide_number),
 'Why is it important to have correct UOM and volumetric data in the WMS?'),

('Inventory', 7, 'Task Management',
 'Learn how to manage labor operations by prioritizing and assigning tasks to users.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Inventory' AND doc_title = 'Inventory Labor Management V1' AND slide_number BETWEEN 45 AND 57 ORDER BY slide_number),
 'How do you assign and prioritize tasks for warehouse users?');

-- ============================================================
-- ADMIN (multi-doc, large)
-- ============================================================
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, chunk_ids, checkpoint_question) VALUES
('Admin', 1, 'WMS User Management',
 'Learn how to create, modify, and manage WMS user accounts.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'System Administration WMS User Management' ORDER BY slide_number),
 'How do you create a new WMS user and assign them the correct permissions?'),

('Admin', 2, 'Warehouse Setup Overview',
 'Learn the key warehouse configuration settings.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'System Administration Warehouse Setup V6' AND slide_number BETWEEN 1 AND 50 ORDER BY slide_number),
 'What are the key settings you need to configure when setting up a warehouse?'),

('Admin', 3, 'Cluster Selection & Load',
 'Learn how to configure cluster selection and load parameters.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'System Administration Cluster Selection Load V1' ORDER BY slide_number),
 'What is cluster selection and how do you configure it in the WMS?'),

('Admin', 4, 'Item Load & UOM Maintenance',
 'Learn the item load process and how to maintain UOM/volumetric data.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'System Administration Item Load-UOM-Volumetrics Maintenance' AND slide_number BETWEEN 1 AND 30 ORDER BY slide_number),
 'What is the item load process and why is maintaining accurate UOM data important?'),

('Admin', 5, 'Item Inventory Load',
 'Learn how to load initial inventory data into the WMS.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'System Administration Item Inventory Load V2' AND slide_number BETWEEN 1 AND 30 ORDER BY slide_number),
 'What are the steps to load inventory data into the WMS?'),

('Admin', 6, 'Item Label Management',
 'Learn how to manage item labels and warehouse label requests.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'DMS Item Label Master V1' ORDER BY slide_number),
 'How do you create and manage item labels in the DMS?'),

('Admin', 7, 'Production Completion Entry',
 'Learn how to process production completion entries in the DMS.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'DMS Production Completion Entry V2' ORDER BY slide_number),
 'What is a production completion entry and when is it used?'),

('Admin', 8, 'Advanced Troubleshooting',
 'Learn advanced troubleshooting techniques for the WMS.',
 ARRAY(SELECT id FROM chunks WHERE module = 'Admin' AND doc_title = 'Tecsys Advanced Troubleshooting Guide' ORDER BY slide_number),
 'What are the key troubleshooting steps when encountering a WMS issue?');

-- 4. Update get_next_onboarding_step() to return chunk_ids instead of search_queries
DROP FUNCTION IF EXISTS get_next_onboarding_step(TEXT, TEXT);
CREATE FUNCTION get_next_onboarding_step(p_user_id TEXT, p_module TEXT)
RETURNS TABLE(
  step_number INT,
  step_title TEXT,
  step_description TEXT,
  chunk_ids TEXT[],
  checkpoint_question TEXT,
  total_steps INT,
  completed_count INT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.step_number,
    c.step_title,
    c.step_description,
    c.chunk_ids,
    c.checkpoint_question,
    (SELECT COUNT(*) FROM onboarding_curriculum WHERE module = p_module)::INT AS total_steps,
    COALESCE(array_length(p.completed_steps, 1), 0)::INT AS completed_count
  FROM onboarding_curriculum c
  LEFT JOIN onboarding_progress p ON p.user_id = p_user_id AND p.module = p_module
  WHERE c.module = p_module
    AND c.step_number = COALESCE(p.current_step, 1)
  LIMIT 1;
END;
$$;

COMMIT;
