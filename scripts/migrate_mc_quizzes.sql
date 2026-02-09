-- Migration: Replace free-text quizzes with multiple-choice questions
-- Adds checkpoint_options (TEXT[]) and correct_option_index (INT) columns,
-- rewrites all 56 checkpoint questions as MC with 4 options each,
-- and updates get_next_onboarding_step() to return the new columns.

BEGIN;

-- 1. Add MC columns
ALTER TABLE onboarding_curriculum
  ADD COLUMN IF NOT EXISTS checkpoint_options TEXT[],
  ADD COLUMN IF NOT EXISTS correct_option_index INT;

-- 2. Update get_next_onboarding_step() to also return checkpoint_options and correct_option_index
DROP FUNCTION IF EXISTS get_next_onboarding_step(TEXT, TEXT);
CREATE FUNCTION get_next_onboarding_step(p_user_id TEXT, p_module TEXT)
RETURNS TABLE(
  step_number INT,
  step_title TEXT,
  step_description TEXT,
  chunk_ids TEXT[],
  checkpoint_question TEXT,
  checkpoint_options TEXT[],
  correct_option_index INT,
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
    c.checkpoint_options,
    c.correct_option_index,
    (SELECT COUNT(*) FROM onboarding_curriculum WHERE module = p_module)::INT AS total_steps,
    COALESCE(array_length(p.completed_steps, 1), 0)::INT AS completed_count
  FROM onboarding_curriculum c
  LEFT JOIN onboarding_progress p ON p.user_id = p_user_id AND p.module = p_module
  WHERE c.module = p_module
    AND c.step_number = COALESCE(p.current_step, 1)
  LIMIT 1;
END;
$$;

-- 3. Rewrite all 56 questions with MC options
-- Format: UPDATE ... SET checkpoint_question, checkpoint_options (4 items), correct_option_index (0-3)

-- ============================================================
-- WAVES (2 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What are the three main stages of wave processing in order?',
    checkpoint_options = ARRAY[
      'Plan, Build, Release',
      'Build, Release, Ship',
      'Create, Pick, Pack',
      'Schedule, Allocate, Complete'
    ],
    correct_option_index = 0
WHERE module = 'Waves' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the key difference between canceling and suspending a wave?',
    checkpoint_options = ARRAY[
      'Canceling removes the wave permanently; suspending pauses it so it can be resumed later',
      'Suspending deletes the wave; canceling just pauses it',
      'They are the same operation with different names',
      'Canceling applies to planned waves; suspending applies to released waves only'
    ],
    correct_option_index = 0
WHERE module = 'Waves' AND step_number = 2;

-- ============================================================
-- PICKING (6 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first thing you do when picking by order on a mobile device?',
    checkpoint_options = ARRAY[
      'Enter or scan the outbound order number',
      'Go to the shipping dock',
      'Print a paper pick list',
      'Open the wave management screen'
    ],
    correct_option_index = 0
WHERE module = 'Picking' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How does Pick by Shipment differ from Pick by Order?',
    checkpoint_options = ARRAY[
      'Pick by Shipment groups picks by shipment rather than individual order',
      'Pick by Shipment is only used for international orders',
      'Pick by Shipment does not require a mobile device',
      'Pick by Shipment skips the container close step'
    ],
    correct_option_index = 0
WHERE module = 'Picking' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you resume an incomplete cluster pick?',
    checkpoint_options = ARRAY[
      'Select the existing cluster ID from the cluster picking menu',
      'Create a new cluster and re-add the remaining orders',
      'Ask a supervisor to reassign the cluster to you',
      'Incomplete clusters cannot be resumed; you must start over'
    ],
    correct_option_index = 0
WHERE module = 'Picking' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What happens when the system detects the final pick for a container?',
    checkpoint_options = ARRAY[
      'The system prompts you to confirm and close the container',
      'The container is automatically closed with no user action needed',
      'The system sends a notification to the supervisor',
      'The container remains open until manually closed from the desktop'
    ],
    correct_option_index = 0
WHERE module = 'Picking' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Which of the following is NOT one of the four picking exceptions?',
    checkpoint_options = ARRAY[
      'Damaged item',
      'Container full',
      'Partial pick (short pick)',
      'Not required'
    ],
    correct_option_index = 0
WHERE module = 'Picking' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first step in conventional (paper-based) picking?',
    checkpoint_options = ARRAY[
      'Print the pick list from the desktop',
      'Scan the first location with a mobile device',
      'Build a wave for the orders',
      'Close all open containers'
    ],
    correct_option_index = 0
WHERE module = 'Picking' AND step_number = 6;

-- ============================================================
-- INBOUND (6 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What should you check before starting the receiving process?',
    checkpoint_options = ARRAY[
      'Verify the receipt schedule and look up the container in the Receiver Tracker',
      'Print all item labels first',
      'Complete a cycle count of the receiving dock',
      'Create a new purchase order in the system'
    ],
    correct_option_index = 0
WHERE module = 'Inbound' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What do you do if the received quantity differs from the PO quantity?',
    checkpoint_options = ARRAY[
      'Enter the actual quantity received and the system records the discrepancy',
      'Reject the entire shipment and send it back',
      'Override the PO to match the received quantity',
      'Accept only the PO quantity and refuse the rest'
    ],
    correct_option_index = 0
WHERE module = 'Inbound' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When is Receipt Closeout performed?',
    checkpoint_options = ARRAY[
      'At the end of the day or when all expected items for a receipt have been received',
      'Before any receiving begins',
      'Only when items fail quality check',
      'Immediately after each individual item is scanned'
    ],
    correct_option_index = 0
WHERE module = 'Inbound' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What information do you need to enter when placing an item into Quality Check?',
    checkpoint_options = ARRAY[
      'The item, quantity, hold code, and reason for the quality hold',
      'Only the item barcode',
      'The supplier name and shipping carrier',
      'The purchase order number and line item number'
    ],
    correct_option_index = 0
WHERE module = 'Inbound' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What are the steps to release a tag for putaway?',
    checkpoint_options = ARRAY[
      'Select the tag on the mobile device and confirm the putaway location',
      'Print a label and place it on the pallet',
      'Create a new storage location in the system',
      'Email the warehouse manager for approval'
    ],
    correct_option_index = 0
WHERE module = 'Inbound' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When would you use Basic Receiving instead of regular receiving?',
    checkpoint_options = ARRAY[
      'When there is no purchase order for the incoming products',
      'When the shipment contains perishable items',
      'When receiving more than 100 items at once',
      'When the mobile device is unavailable'
    ],
    correct_option_index = 0
WHERE module = 'Inbound' AND step_number = 6;

-- ============================================================
-- OUTBOUND (7 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you identify records with errors in the Staging Table Summary?',
    checkpoint_options = ARRAY[
      'Records with errors are highlighted or flagged with an error status indicator',
      'You must manually check each record by opening it',
      'Error records are automatically deleted from the table',
      'The system sends an email notification for each error'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When would you use Container Merge instead of Container Build?',
    checkpoint_options = ARRAY[
      'When you need to combine items from multiple containers into one for the same shipment',
      'When building a brand new container from scratch',
      'When splitting a container into two smaller ones',
      'When the container weighs more than the carrier limit'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Which of the following can be modified through the Shipment Edit resource?',
    checkpoint_options = ARRAY[
      'Carrier, ship-to address, and shipment priority',
      'The items already picked for the shipment',
      'The warehouse the shipment originates from',
      'The customer who placed the original order'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the final step in the parcel shipping workflow?',
    checkpoint_options = ARRAY[
      'Generate the TMS shipment to produce a tracking number and label',
      'Print a paper manifest',
      'Move the parcel to the loading dock',
      'Close the outbound order in the staging table'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is a manifest in the WMS?',
    checkpoint_options = ARRAY[
      'A document that closes a carrier load and lists all shipments included for pickup',
      'A list of all items in the warehouse',
      'A report showing daily shipping errors',
      'A label printed on each individual package'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What happens to inventory when a shipment is completed?',
    checkpoint_options = ARRAY[
      'Inventory is deducted from the WMS and the shipment is finalized',
      'Inventory remains in the system until the customer confirms delivery',
      'Inventory is moved to a virtual "shipped" location but not removed',
      'Nothing happens to inventory; only the order status changes'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 6;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first step when processing a cancelled outbound order?',
    checkpoint_options = ARRAY[
      'Void the TMS shipment',
      'Return the inventory to the original pick location',
      'Delete the order from the staging table',
      'Notify the customer of the cancellation'
    ],
    correct_option_index = 0
WHERE module = 'Outbound' AND step_number = 7;

-- ============================================================
-- NAVIGATION (6 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What are the two types of computers used to interact with the WMS?',
    checkpoint_options = ARRAY[
      'Desktop computers and mobile (handheld RF) devices',
      'Laptops and tablets',
      'Servers and workstations',
      'Personal phones and smartwatches'
    ],
    correct_option_index = 0
WHERE module = 'Navigation' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you navigate to a specific resource in the WMS portal?',
    checkpoint_options = ARRAY[
      'Use the menu tree or type the resource code in the search bar',
      'Open a web browser and type the resource URL',
      'Send an email request to IT support',
      'Resources are only accessible from the home screen shortcuts'
    ],
    correct_option_index = 0
WHERE module = 'Navigation' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you add a bookmark in the WMS toolbox panel?',
    checkpoint_options = ARRAY[
      'Navigate to the resource and click the bookmark/star icon in the toolbox panel',
      'Right-click the resource name and select "Add to Favorites"',
      'Type the resource code in the bookmark configuration file',
      'Bookmarks are automatically added for frequently used resources'
    ],
    correct_option_index = 0
WHERE module = 'Navigation' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is an auto-fill criteria set used for?',
    checkpoint_options = ARRAY[
      'Saving frequently used search criteria so you can reapply them quickly',
      'Automatically filling in form fields when creating new records',
      'Populating item descriptions from a master database',
      'Generating reports with pre-defined filters'
    ],
    correct_option_index = 0
WHERE module = 'Navigation' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Which hot key refreshes the current view in the WMS?',
    checkpoint_options = ARRAY[
      'F5',
      'Ctrl+R',
      'Alt+F4',
      'Escape'
    ],
    correct_option_index = 0
WHERE module = 'Navigation' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What three sections of a view can you personalize?',
    checkpoint_options = ARRAY[
      'Search criteria, results columns, and details layout',
      'Menu bar, toolbar, and status bar',
      'Header, body, and footer',
      'Fonts, colors, and icons'
    ],
    correct_option_index = 0
WHERE module = 'Navigation' AND step_number = 6;

-- ============================================================
-- CYCLE COUNTS (6 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What are the three options for specifying items in a planned cycle count?',
    checkpoint_options = ARRAY[
      'By item, by location, or by zone',
      'By weight, by size, or by color',
      'By department, by vendor, or by cost',
      'By date received, by expiration, or by lot number'
    ],
    correct_option_index = 0
WHERE module = 'CycleCounts' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What do you do if your physical count differs from the system count during a system-directed cycle count?',
    checkpoint_options = ARRAY[
      'Enter the actual count you physically observed; the system records the variance',
      'Change your count to match the system to avoid discrepancies',
      'Skip that location and move to the next one',
      'Immediately notify a supervisor before entering anything'
    ],
    correct_option_index = 0
WHERE module = 'CycleCounts' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When would you use Cycle Count by Order instead of system-directed?',
    checkpoint_options = ARRAY[
      'When you need to count specific locations defined in a planned cycle count order',
      'When the mobile device is not available',
      'When counting items that have no barcode',
      'When the warehouse is closed for the day'
    ],
    correct_option_index = 0
WHERE module = 'CycleCounts' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What triggers a demand cycle count?',
    checkpoint_options = ARRAY[
      'A picking or inventory discrepancy that requires an immediate recount of a location',
      'A scheduled weekly inventory review',
      'A supervisor manually requesting a full warehouse count',
      'A new shipment arriving at the receiving dock'
    ],
    correct_option_index = 0
WHERE module = 'CycleCounts' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first step when completing a paper-based cycle count on desktop?',
    checkpoint_options = ARRAY[
      'Print the cycle count list from the desktop',
      'Scan each item with a mobile device',
      'Enter the count directly into the cycle count resource',
      'Email the list to the warehouse team'
    ],
    correct_option_index = 0
WHERE module = 'CycleCounts' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When is supervisor approval required for cycle count exceptions?',
    checkpoint_options = ARRAY[
      'When the variance between the system count and the physical count exceeds the configured threshold',
      'For every single cycle count regardless of variance',
      'Only when the count shows zero items in a location',
      'Approval is never required; exceptions are auto-accepted'
    ],
    correct_option_index = 0
WHERE module = 'CycleCounts' AND step_number = 6;

-- ============================================================
-- REPLENISHMENT (5 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What happens if a store command is assigned during system-directed replenishment?',
    checkpoint_options = ARRAY[
      'The system prompts you to complete the store task before continuing replenishment',
      'The store command is ignored until replenishment is complete',
      'The replenishment task is automatically cancelled',
      'You must log out and log back in to clear the conflict'
    ],
    correct_option_index = 0
WHERE module = 'Replenishment' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What options are available when setting up a replenishment by section?',
    checkpoint_options = ARRAY[
      'Section ID, item filter, and replenishment priority',
      'Only the section ID — no other options exist',
      'Carrier name and delivery date',
      'Customer order number and shipment ID'
    ],
    correct_option_index = 0
WHERE module = 'Replenishment' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How does Replenish by Area differ from Replenish by Section?',
    checkpoint_options = ARRAY[
      'Replenish by Area covers a broader zone that may include multiple sections',
      'Replenish by Area only works on the mobile device',
      'Replenish by Area is used for perishable items only',
      'There is no difference; they are the same function'
    ],
    correct_option_index = 0
WHERE module = 'Replenishment' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When would you use Replenish by Location?',
    checkpoint_options = ARRAY[
      'When a specific pick location is empty and needs to be restocked immediately',
      'When replenishing the entire warehouse at once',
      'When moving items between warehouses',
      'When the section-based replenishment has already been completed'
    ],
    correct_option_index = 0
WHERE module = 'Replenishment' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you create a replenishment wave from the desktop?',
    checkpoint_options = ARRAY[
      'Use the replenishment wave resource, specify criteria like section and priority, then release the wave',
      'Send an email to the warehouse manager with the replenishment request',
      'Replenishment waves can only be created on mobile devices',
      'Click the "Auto-Replenish" button on the home screen'
    ],
    correct_option_index = 0
WHERE module = 'Replenishment' AND step_number = 5;

-- ============================================================
-- RETURNS (3 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What is an RMA?',
    checkpoint_options = ARRAY[
      'A Return Merchandise Authorization — a pre-approval required before processing any customer return',
      'A Real-time Monitoring Alert for tracking shipments',
      'A Receiving Materials Assessment for quality checks',
      'A Resource Management Application used by supervisors'
    ],
    correct_option_index = 0
WHERE module = 'Returns' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first step when planning an inbound return?',
    checkpoint_options = ARRAY[
      'Create or locate the RMA and set up the return receipt in the WMS',
      'Inspect the returned items at the loading dock',
      'Generate a shipping label for the customer',
      'Move existing inventory to make room for the returns'
    ],
    correct_option_index = 0
WHERE module = 'Returns' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What extra steps are needed when receiving serial-numbered returned items?',
    checkpoint_options = ARRAY[
      'You must scan or enter each individual serial number during the receiving process',
      'Serial-numbered items do not require any extra steps',
      'You must contact the manufacturer to verify each serial number',
      'Serial-numbered items must be sent directly to quality check without receiving'
    ],
    correct_option_index = 0
WHERE module = 'Returns' AND step_number = 3;

-- ============================================================
-- INVENTORY (7 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first step to store a product using the mobile device?',
    checkpoint_options = ARRAY[
      'Scan the tag or license plate of the product to be stored',
      'Enter the storage location first',
      'Print a putaway label from the desktop',
      'Weigh the product on the warehouse scale'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Can you move a partial quantity of inventory from one location to another?',
    checkpoint_options = ARRAY[
      'Yes, you can specify the quantity to move and leave the rest in the original location',
      'No, you must move the entire quantity at once',
      'Only if a supervisor approves the partial move',
      'Partial moves are only available from the desktop, not mobile'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the difference between an Inventory Move and an Inventory Relocation?',
    checkpoint_options = ARRAY[
      'Move is mobile-based for physical transfers; Relocation is desktop-based for system-level changes',
      'They are exactly the same operation',
      'Move is for raw materials; Relocation is for finished goods',
      'Move requires a wave; Relocation does not'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When would you make an inventory adjustment in the WMS?',
    checkpoint_options = ARRAY[
      'When the physical quantity does not match the system quantity and needs to be corrected',
      'Every time a shipment is received',
      'Only during annual inventory audits',
      'When transferring inventory to another warehouse'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Which of the following can you modify through Inventory Status Modification?',
    checkpoint_options = ARRAY[
      'Hold code, status, and inventory attributes',
      'Item price and vendor information',
      'The physical location of the inventory',
      'The customer order linked to the inventory'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Why is correct UOM and volumetric data important in the WMS?',
    checkpoint_options = ARRAY[
      'It ensures accurate storage allocation, picking efficiency, and shipping cost calculations',
      'It is only needed for customs declarations on international shipments',
      'It is optional and does not affect warehouse operations',
      'It is only used for generating inventory reports'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 6;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you assign a task to a specific warehouse user?',
    checkpoint_options = ARRAY[
      'Use the Task Management resource to select the task and assign it to a user or group',
      'Tasks are always automatically assigned and cannot be manually changed',
      'Send the user an email with the task details',
      'Write the task on the whiteboard in the break room'
    ],
    correct_option_index = 0
WHERE module = 'Inventory' AND step_number = 7;

-- ============================================================
-- ADMIN (8 steps)
-- ============================================================
UPDATE onboarding_curriculum
SET checkpoint_question = 'What is required when creating a new WMS user?',
    checkpoint_options = ARRAY[
      'A user ID, password, and the correct role/permission group assignment',
      'Only an email address',
      'A supervisor must create the user in person at the IT desk',
      'New users are auto-created when they first log in'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 1;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Which of the following is a key setting when configuring a new warehouse?',
    checkpoint_options = ARRAY[
      'Warehouse ID, time zone, address, and default storage zones',
      'The color scheme of the WMS portal',
      'The number of employees in the warehouse',
      'The brand of mobile devices used'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 2;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is cluster selection used for in the WMS?',
    checkpoint_options = ARRAY[
      'Grouping picks or tasks together for more efficient batch processing',
      'Selecting which servers run the WMS application',
      'Choosing which warehouse to ship from',
      'Filtering cycle count results by zone'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 3;

UPDATE onboarding_curriculum
SET checkpoint_question = 'Why is maintaining accurate UOM data important during item load?',
    checkpoint_options = ARRAY[
      'Incorrect UOM data causes errors in receiving, picking, and shipping quantities',
      'UOM data is only used for display purposes and has no operational impact',
      'UOM data is automatically corrected by the system',
      'UOM only matters for items sold by weight'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 4;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the purpose of the item inventory load process?',
    checkpoint_options = ARRAY[
      'To load initial inventory quantities and locations into the WMS during setup',
      'To count all items in the warehouse daily',
      'To print labels for every item in the system',
      'To remove discontinued items from the database'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 5;

UPDATE onboarding_curriculum
SET checkpoint_question = 'How do you create an item label in the DMS?',
    checkpoint_options = ARRAY[
      'Use the Item Label Master resource to define the label format and assign it to items',
      'Labels are automatically generated — no manual creation needed',
      'Print a blank label and write the item details by hand',
      'Upload a spreadsheet of label designs to the DMS'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 6;

UPDATE onboarding_curriculum
SET checkpoint_question = 'When is a production completion entry used?',
    checkpoint_options = ARRAY[
      'When a manufacturing or assembly process finishes and the resulting inventory needs to be recorded in the system',
      'When an employee completes their training',
      'When a shipment reaches its final destination',
      'When a cycle count is approved by a supervisor'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 7;

UPDATE onboarding_curriculum
SET checkpoint_question = 'What is the first troubleshooting step when encountering a WMS issue?',
    checkpoint_options = ARRAY[
      'Check the error message details and try to reproduce the issue',
      'Immediately restart the WMS server',
      'Delete and recreate the affected record',
      'Switch to a different warehouse in the system'
    ],
    correct_option_index = 0
WHERE module = 'Admin' AND step_number = 8;

-- 4. Verify: all 56 rows should have non-null checkpoint_options with 4 elements
-- SELECT module, step_number, array_length(checkpoint_options, 1), correct_option_index
-- FROM onboarding_curriculum ORDER BY module, step_number;

COMMIT;
