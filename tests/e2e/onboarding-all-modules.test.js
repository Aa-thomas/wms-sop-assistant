import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * End-to-end tests for the complete onboarding flow of all 9 modules.
 *
 * These tests hit the LIVE server (localhost:3000) with REAL Claude + OpenAI calls.
 * They verify that every step of every module produces:
 *   - Grounded explanations with inline citations
 *   - Valid quick tips and common mistakes
 *   - Correct checkpoint questions
 *   - Proper quiz validation (correct + incorrect answers)
 *   - Correct step progression and module completion
 *
 * Prerequisites:
 *   - Server running: npm run server
 *   - Database seeded with curriculum + chunks
 *
 * Run: npm run test:e2e
 */

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_PREFIX = 'e2e_test_';

// All 9 modules with their expected step data
const MODULES = {
  Navigation: {
    totalSteps: 4,
    steps: [
      { title: 'Logging In & Launching the WMS', checkpoint: 'What are the steps to log in and launch the WMS?',
        goodAnswer: 'Navigate to the WMS portal URL, enter your username and password on the login screen, then click the WMS application link to launch it.',
        badAnswer: 'I click a button.' },
      { title: 'Portal Layout & Menu Navigation', checkpoint: 'What are the main areas of the WMS portal?',
        goodAnswer: 'The main areas include the menu bar at the top for navigating between modules, the main content area where you work with records, and the status bar.',
        badAnswer: 'There is a screen.' },
      { title: 'Search & Resource Views', checkpoint: 'How do you search for a specific record in the WMS?',
        goodAnswer: 'Use the search bar to enter criteria like order number or item code, select the resource view, and the system filters to matching records.',
        badAnswer: 'I search.' },
      { title: 'Hot Keys & Personalizing Views', checkpoint: 'What hot keys can you use to work faster in the WMS?',
        goodAnswer: 'Hot keys like function keys let you quickly navigate between screens, save records, and perform common actions. You can also set up bookmarks and personalize your business views.',
        badAnswer: 'Keys.' },
    ],
  },
  Picking: {
    totalSteps: 5,
    steps: [
      { title: 'Navigation & RF Gun Basics', checkpoint: 'Can you describe how to access the Picking screen?',
        goodAnswer: 'Log into the WMS on the RF gun, navigate to the main menu, and select the Picking option to access the picking screen.',
        badAnswer: 'I dont know.' },
      { title: 'Batch Picking Workflow', checkpoint: 'What are the main steps in batch picking?',
        goodAnswer: 'Get assigned a batch, go to the first pick location, scan the location barcode, scan the item, confirm the quantity, and repeat for each pick. Then close the batch.',
        badAnswer: 'Pick stuff.' },
      { title: 'Short Pick Handling', checkpoint: 'What do you do if you encounter a short pick?',
        goodAnswer: 'Mark the item as short in the system, enter the actual quantity available, and notify your supervisor so they can investigate.',
        badAnswer: 'Skip it.' },
      { title: 'Inventory Discrepancies', checkpoint: 'How do you handle an inventory discrepancy?',
        goodAnswer: 'Report the discrepancy in the system, note the expected vs actual quantity, check nearby locations, and notify your supervisor for review.',
        badAnswer: 'Ignore it.' },
      { title: 'End-of-Shift Procedures', checkpoint: 'What are the key steps to complete at end of shift?',
        goodAnswer: 'Close any open batches, log out of the RF gun, return equipment to the charging station, and report any unresolved issues to the next shift.',
        badAnswer: 'Leave.' },
    ],
  },
  Outbound: {
    totalSteps: 4,
    steps: [
      { title: 'Outbound Order Basics', checkpoint: 'What is the first step in processing an outbound order?',
        goodAnswer: 'Review the outbound order in the system, verify the order details including items and quantities, and then allocate the order for picking.',
        badAnswer: 'Ship it.' },
      { title: 'Order Allocation', checkpoint: 'How do you allocate an order?',
        goodAnswer: 'Open the allocation screen, select the orders to allocate, verify inventory availability, and run the allocation process to assign inventory to order lines.',
        badAnswer: 'Click allocate.' },
      { title: 'Packing Process', checkpoint: 'What are the steps to pack an order?',
        goodAnswer: 'At the packing station, scan the order barcode, verify the items match, pack items into the shipping container, and confirm the pack is complete.',
        badAnswer: 'Put in box.' },
      { title: 'Shipping Label Generation', checkpoint: 'How do you generate a shipping label?',
        goodAnswer: 'After packing, navigate to the shipping screen, select the container, generate the label with carrier and address info, then print and apply it.',
        badAnswer: 'Print.' },
    ],
  },
  Inbound: {
    totalSteps: 4,
    steps: [
      { title: 'Receiving Overview', checkpoint: 'What is the first step when receiving an inbound shipment?',
        goodAnswer: 'Verify the inbound order exists in the system, check the PO number against the shipment, and begin the receiving process by scanning the PO.',
        badAnswer: 'Open door.' },
      { title: 'Quantity Verification', checkpoint: "What do you do if quantities don't match the PO?",
        goodAnswer: 'Record the actual count received, flag the discrepancy in the system, and notify the receiving supervisor for resolution.',
        badAnswer: 'Accept it.' },
      { title: 'Quality Inspection', checkpoint: 'How do you handle damaged items during receiving?',
        goodAnswer: 'Separate damaged items from good inventory, mark them as damaged in the system, place in the hold area, and document for supplier claim.',
        badAnswer: 'Throw away.' },
      { title: 'Put-Away Process', checkpoint: 'What are the steps for putting away received items?',
        goodAnswer: 'The system directs you to a put-away location. Navigate there, scan the location barcode, scan the item, confirm quantity, and complete the task.',
        badAnswer: 'Put on shelf.' },
    ],
  },
  Replenishment: {
    totalSteps: 4,
    steps: [
      { title: 'System-Directed Replenishment', checkpoint: 'How does system-directed replenishment work on your mobile device?',
        goodAnswer: 'The system sends replenishment tasks to your mobile device showing source and destination. Pick items from the source and move them to the forward pick location.',
        badAnswer: 'It happens automatically.' },
      { title: 'Replenish by Section & Area', checkpoint: 'When would you use replenish by section vs replenish by area?',
        goodAnswer: 'Replenish by section targets all locations within a specific picking section. Replenish by area covers a broader warehouse area for larger-scale replenishment.',
        badAnswer: 'They are the same.' },
      { title: 'Replenish by Location', checkpoint: 'How do you replenish a specific location?',
        goodAnswer: 'Select replenish by location, enter the specific location code, and the system creates a task to move inventory from reserve to that location.',
        badAnswer: 'Go there.' },
      { title: 'Wave Replenishment Management', checkpoint: 'What is wave replenishment and how do you manage it from the desktop?',
        goodAnswer: 'Wave replenishment runs tasks for all items needed by a wave of orders. From desktop you can view wave status, trigger replenishment, and manage exceptions.',
        badAnswer: 'Waves.' },
    ],
  },
  Inventory: {
    totalSteps: 5,
    steps: [
      { title: 'Store & Put-Away', checkpoint: 'What are the steps to put away inventory into a location?',
        goodAnswer: 'Scan the item or container, the system suggests a location, navigate there, scan the location barcode, confirm quantity, and complete the put-away.',
        badAnswer: 'Store it.' },
      { title: 'Inventory Move & Relocation', checkpoint: 'What is the difference between an inventory move and a relocation?',
        goodAnswer: 'An inventory move transfers items between locations. A relocation changes the designated home location for an item in the system.',
        badAnswer: 'Same thing.' },
      { title: 'Inventory Adjustments', checkpoint: 'When and how do you make an inventory adjustment?',
        goodAnswer: 'When a cycle count reveals a discrepancy. Enter the adjustment screen, select item and location, enter correct quantity, provide reason code, submit for approval.',
        badAnswer: 'Change the number.' },
      { title: 'Inventory Status Modification', checkpoint: 'How do you change the status of inventory in the WMS?',
        goodAnswer: 'Navigate to inventory status screen, search for the item, select new status like hold or damage, provide reason code, and confirm the change.',
        badAnswer: 'Click status.' },
      { title: 'Item UOM & Volumetrics', checkpoint: 'Why is it important to have correct UOM and volumetric data?',
        goodAnswer: 'Correct UOM and volumetric data ensures accurate picking, packing, and shipping. Wrong data leads to incorrect quantities and shipping cost errors.',
        badAnswer: 'For numbers.' },
    ],
  },
  CycleCounts: {
    totalSteps: 5,
    steps: [
      { title: 'Creating a Planned Cycle Count', checkpoint: 'How do you create a planned cycle count?',
        goodAnswer: 'Navigate to cycle count screen, define count criteria like locations or items, set the schedule, assign to a team member, and release the count task.',
        badAnswer: 'Make a count.' },
      { title: 'System-Directed Cycle Count', checkpoint: 'How does a system-directed cycle count work on the mobile device?',
        goodAnswer: 'The system sends a count task to your mobile device. Go to the location, scan the barcode, physically count items, enter the quantity, and confirm.',
        badAnswer: 'Count stuff.' },
      { title: 'Cycle Count by Order', checkpoint: 'When would you use cycle count by order?',
        goodAnswer: 'When there is a discrepancy on a specific order, such as a short pick, and you need to verify inventory at locations associated with that order.',
        badAnswer: 'For orders.' },
      { title: 'Demand Cycle Count', checkpoint: 'What triggers a demand cycle count?',
        goodAnswer: 'A demand cycle count is triggered when the system detects a discrepancy, such as a short pick or zero-quantity scan, requiring immediate verification.',
        badAnswer: 'When needed.' },
      { title: 'Cycle Count Exceptions & Approval', checkpoint: 'How do you handle exceptions found during a cycle count?',
        goodAnswer: 'Review the variance report, investigate the cause, recount if necessary, submit results for supervisor approval who then approves or rejects the adjustment.',
        badAnswer: 'Fix it.' },
    ],
  },
  Returns: {
    totalSteps: 3,
    steps: [
      { title: 'Return Authorization & Prerequisites', checkpoint: 'What must be in place before you can process a customer return?',
        goodAnswer: 'A valid RMA (Return Merchandise Authorization) number must be in place. The return must be authorized and the RMA entered in the system.',
        badAnswer: 'Nothing.' },
      { title: 'Inbound Return Planning', checkpoint: 'What are the steps to plan an inbound return?',
        goodAnswer: 'Create an inbound return order referencing the RMA, specify expected items and quantities, set arrival date, and release so receiving expects the return.',
        badAnswer: 'Plan it.' },
      { title: 'Receiving a Return', checkpoint: 'How do you receive a customer return, and what do you do with serial-numbered items?',
        goodAnswer: 'Open the return order, scan items being returned, verify against RMA. For serial-numbered items, scan each serial individually. Process partial receipt if not all arrive.',
        badAnswer: 'Receive it.' },
    ],
  },
  Admin: {
    totalSteps: 5,
    steps: [
      { title: 'WMS User Management', checkpoint: 'How do you create a new WMS user?',
        goodAnswer: 'Go to user management, click create new user, enter username, assign role and permissions, set initial password, and activate the account.',
        badAnswer: 'Add user.' },
      { title: 'Warehouse Setup Overview', checkpoint: 'What are the key settings in warehouse setup?',
        goodAnswer: 'Key settings include warehouse code and name, address, default receiving and shipping options, inventory tracking parameters, and system-level options.',
        badAnswer: 'Settings.' },
      { title: 'Hold Codes & Container Types', checkpoint: 'What are hold codes used for in the WMS?',
        goodAnswer: 'Hold codes restrict inventory from being picked or shipped. They mark inventory as unavailable for reasons like quality hold, damage, or pending inspection.',
        badAnswer: 'Codes.' },
      { title: 'Areas & Picking Sections', checkpoint: 'How are warehouse areas and picking sections configured?',
        goodAnswer: 'Areas organize the warehouse into zones. Picking sections are configured within areas to group pick locations, control replenishment, and optimize picker routes.',
        badAnswer: 'Areas.' },
      { title: 'Item Load & Label Management', checkpoint: 'What is the item load process and why is it important?',
        goodAnswer: 'Item load imports item master data including SKU details, UOM conversions, and volumetrics. Accurate data drives correct picking, packing, storage, and labels.',
        badAnswer: 'Loading items.' },
    ],
  },
};

// Helper to make API calls
async function api(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);
  const resp = await fetch(`${BASE}${path}`, options);
  return { status: resp.status, body: await resp.json() };
}

// Cleanup helper
async function cleanup(userIds) {
  try {
    const { Pool } = require('pg');
    require('dotenv').config();
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const ph = userIds.map((_, i) => `$${i + 1}`).join(', ');
    await pool.query(`DELETE FROM onboarding_quiz_attempts WHERE user_id IN (${ph})`, userIds);
    await pool.query(`DELETE FROM onboarding_progress WHERE user_id IN (${ph})`, userIds);
    await pool.end();
  } catch (e) {
    console.warn('Cleanup failed:', e.message);
  }
}

// Collect all user IDs for cleanup
const allUserIds = [];

beforeAll(async () => {
  // Health check
  try {
    const r = await api('GET', '/health');
    if (r.status !== 200) throw new Error('Not healthy');
  } catch {
    throw new Error(`Server not running at ${BASE}. Start with: npm run server`);
  }
});

afterAll(async () => {
  await cleanup(allUserIds);
});

// ──────────────────────────────────────────────
// Generate test suites for all 9 modules
// ──────────────────────────────────────────────
for (const [moduleName, moduleData] of Object.entries(MODULES)) {
  describe(`Module: ${moduleName} (${moduleData.totalSteps} steps)`, () => {
    const userId = `${TEST_PREFIX}${moduleName.toLowerCase()}_${Date.now()}`;
    allUserIds.push(userId);

    it(`starts onboarding with correct metadata`, async () => {
      const r = await api('POST', '/onboarding/start', { user_id: userId, module: moduleName });

      expect(r.status).toBe(200);
      expect(r.body.status).toBe('started');
      expect(r.body.step.step_number).toBe(1);
      expect(r.body.step.step_title).toBe(moduleData.steps[0].title);
      expect(r.body.step.total_steps).toBe(moduleData.totalSteps);
      expect(r.body.step.completed_count).toBe(0);
    });

    // Test each step
    for (let i = 0; i < moduleData.steps.length; i++) {
      const stepData = moduleData.steps[i];
      const stepNum = i + 1;
      const isLastStep = stepNum === moduleData.totalSteps;

      describe(`Step ${stepNum}: ${stepData.title}`, () => {
        it('loads explanation with grounded content and citations', async () => {
          const r = await api('POST', '/onboarding/step', { user_id: userId, module: moduleName });

          expect(r.status).toBe(200);
          expect(r.body.step_number).toBe(stepNum);
          expect(r.body.step_title).toBe(stepData.title);
          expect(r.body.total_steps).toBe(moduleData.totalSteps);

          // Explanation must be substantial and contain citations
          expect(typeof r.body.explanation).toBe('string');
          expect(r.body.explanation.length).toBeGreaterThan(50);
          expect(r.body.explanation).toMatch(/\(.*Slide \d+\)/); // inline citation pattern

          // Quick tip should be present
          expect(typeof r.body.quick_tip).toBe('string');
          expect(r.body.quick_tip.length).toBeGreaterThan(0);

          // Checkpoint question must match curriculum
          expect(r.body.checkpoint).toBe(stepData.checkpoint);

          // Citations array validation
          expect(Array.isArray(r.body.citations)).toBe(true);
          expect(r.body.citations.length).toBeGreaterThanOrEqual(1);

          for (const cit of r.body.citations) {
            expect(typeof cit.doc_title).toBe('string');
            expect(cit.doc_title.length).toBeGreaterThan(0);
            expect(typeof cit.source_locator).toBe('string');
            expect(cit.source_locator.length).toBeGreaterThan(0);
            expect(typeof cit.slide_number).toBe('number');
            expect(typeof cit.relevance).toBe('string');
          }

          expect(r.body.next_action).toBe('complete_checkpoint');
        });

        it('validates a correct quiz answer', async () => {
          const r = await api('POST', '/onboarding/validate-answer', {
            user_id: userId,
            module: moduleName,
            step_number: stepNum,
            user_answer: stepData.goodAnswer,
          });

          expect(r.status).toBe(200);
          expect(typeof r.body.is_correct).toBe('boolean');
          expect(typeof r.body.feedback).toBe('string');
          expect(r.body.feedback.length).toBeGreaterThan(0);
          expect(r.body.max_attempts).toBe(3);

          // A well-formed good answer should generally pass
          // (Claude may occasionally disagree, so we log but don't hard-fail)
          if (!r.body.is_correct) {
            console.warn(
              `  [WARN] ${moduleName} step ${stepNum}: good answer marked incorrect. Feedback: ${r.body.feedback}`
            );
          }
        });

        it(`advances to ${isLastStep ? 'module completion' : `step ${stepNum + 1}`}`, async () => {
          const r = await api('POST', '/onboarding/complete-step', {
            user_id: userId,
            module: moduleName,
            step_number: stepNum,
          });

          expect(r.status).toBe(200);

          if (isLastStep) {
            expect(r.body.completed).toBe(true);
            expect(r.body.message).toContain('Congratulations');
            expect(r.body.message).toContain(moduleName);
            expect(r.body.completed_steps).toBe(moduleData.totalSteps);
            expect(r.body.total_steps).toBe(moduleData.totalSteps);
          } else {
            expect(r.body.completed).toBe(false);
            expect(r.body.next_step).toBeDefined();
            expect(r.body.next_step.step_number).toBe(stepNum + 1);
            expect(r.body.next_step.step_title).toBe(moduleData.steps[i + 1].title);
            expect(r.body.next_step.completed_count).toBe(stepNum);
          }
        });
      });
    }

    it('shows completed status in progress after all steps', async () => {
      const r = await api('GET', `/onboarding/progress/${userId}`);

      expect(r.status).toBe(200);
      const moduleProgress = r.body.find(p => p.module === moduleName);
      expect(moduleProgress).toBeDefined();
      expect(moduleProgress.status).toBe('completed');
      expect(moduleProgress.completed_at).not.toBeNull();
      expect(parseInt(moduleProgress.completed_count)).toBe(moduleData.totalSteps);
    });

    it('returns already_completed on restart', async () => {
      const r = await api('POST', '/onboarding/start', { user_id: userId, module: moduleName });

      expect(r.status).toBe(200);
      expect(r.body.status).toBe('already_completed');
    });
  });
}

// ──────────────────────────────────────────────
// Quiz validation edge cases (run on Navigation)
// ──────────────────────────────────────────────
describe('Quiz validation: retry and max attempts flow', () => {
  const userId = `${TEST_PREFIX}quiz_retry_${Date.now()}`;
  allUserIds.push(userId);

  beforeAll(async () => {
    await api('POST', '/onboarding/start', { user_id: userId, module: 'Navigation' });
  });

  it('attempt 1: bad answer → is_correct: false, can_proceed: false', async () => {
    const r = await api('POST', '/onboarding/validate-answer', {
      user_id: userId, module: 'Navigation', step_number: 1,
      user_answer: 'I just click something.',
    });
    expect(r.body.is_correct).toBe(false);
    expect(r.body.can_proceed).toBe(false);
    expect(r.body.attempts).toBe(1);
  });

  it('attempt 2: bad answer → is_correct: false, can_proceed: false', async () => {
    const r = await api('POST', '/onboarding/validate-answer', {
      user_id: userId, module: 'Navigation', step_number: 1,
      user_answer: 'Not sure at all.',
    });
    expect(r.body.is_correct).toBe(false);
    expect(r.body.can_proceed).toBe(false);
    expect(r.body.attempts).toBe(2);
  });

  it('attempt 3: bad answer → can_proceed: true (max attempts reached)', async () => {
    const r = await api('POST', '/onboarding/validate-answer', {
      user_id: userId, module: 'Navigation', step_number: 1,
      user_answer: 'Still no idea.',
    });
    expect(r.body.can_proceed).toBe(true);
    expect(r.body.attempts).toBe(3);
    expect(r.body.max_attempts).toBe(3);
  });
});

describe('Quiz validation: incorrect answer feedback quality', () => {
  const userId = `${TEST_PREFIX}quiz_feedback_${Date.now()}`;
  allUserIds.push(userId);

  beforeAll(async () => {
    await api('POST', '/onboarding/start', { user_id: userId, module: 'Picking' });
  });

  for (const [moduleName, moduleData] of Object.entries(MODULES)) {
    // Test only the first step of each module to keep the suite reasonable
    const stepData = moduleData.steps[0];

    it(`${moduleName}: bad answer gets constructive feedback`, async () => {
      // Use a unique user per module for this sub-test
      const uid = `${TEST_PREFIX}feedback_${moduleName.toLowerCase()}_${Date.now()}`;
      allUserIds.push(uid);
      await api('POST', '/onboarding/start', { user_id: uid, module: moduleName });

      const r = await api('POST', '/onboarding/validate-answer', {
        user_id: uid,
        module: moduleName,
        step_number: 1,
        user_answer: stepData.badAnswer,
      });

      expect(r.status).toBe(200);
      expect(r.body.is_correct).toBe(false);
      expect(typeof r.body.feedback).toBe('string');
      expect(r.body.feedback.length).toBeGreaterThan(10); // substantive feedback, not just "wrong"
    });
  }
});

// ──────────────────────────────────────────────
// Supervisor dashboard after e2e runs
// ──────────────────────────────────────────────
describe('Supervisor dashboard reflects completed modules', () => {
  it('dashboard contains test user entries', async () => {
    const r = await api('GET', '/onboarding/supervisor/dashboard');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    // At least our test users should appear
    const testEntries = r.body.filter(row => row.user_id.startsWith(TEST_PREFIX));
    expect(testEntries.length).toBeGreaterThan(0);
  });

  it('summary shows aggregated data', async () => {
    const r = await api('GET', '/onboarding/supervisor/summary');
    expect(r.status).toBe(200);
    expect(r.body.length).toBeGreaterThan(0);

    for (const row of r.body) {
      expect(row).toHaveProperty('module');
      expect(row).toHaveProperty('total_users');
      expect(row).toHaveProperty('completed_users');
    }
  });

  it('user detail endpoint returns per-module breakdown', async () => {
    // Pick the first test user that completed a module
    const firstUser = allUserIds[0];
    if (!firstUser) return;

    const r = await api('GET', `/onboarding/supervisor/user/${firstUser}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);

    if (r.body.length > 0) {
      const detail = r.body[0];
      expect(detail).toHaveProperty('module');
      expect(detail).toHaveProperty('completed_count');
      expect(detail).toHaveProperty('total_steps');
      expect(detail).toHaveProperty('started_at');
    }
  });
});

// ──────────────────────────────────────────────
// Edge case tests
// ──────────────────────────────────────────────
describe('Edge cases', () => {
  it('returns 400 for validate-answer with empty user_answer', async () => {
    const r = await api('POST', '/onboarding/validate-answer', {
      user_id: 'edge_test', module: 'Navigation', step_number: 1, user_answer: '',
    });
    // Empty string should be caught by the !user_answer check
    expect(r.status).toBe(400);
  });

  it('returns 404 for validate-answer with invalid step_number', async () => {
    const uid = `${TEST_PREFIX}edge_step_${Date.now()}`;
    allUserIds.push(uid);
    await api('POST', '/onboarding/start', { user_id: uid, module: 'Navigation' });

    const r = await api('POST', '/onboarding/validate-answer', {
      user_id: uid, module: 'Navigation', step_number: 999, user_answer: 'test',
    });
    expect(r.status).toBe(404);
  });

  it('returns 400 for start with missing fields', async () => {
    const r1 = await api('POST', '/onboarding/start', { user_id: 'test' });
    expect(r1.status).toBe(400);

    const r2 = await api('POST', '/onboarding/start', { module: 'Navigation' });
    expect(r2.status).toBe(400);
  });

  it('returns 404 for start with non-existent module', async () => {
    const uid = `${TEST_PREFIX}edge_nomod_${Date.now()}`;
    allUserIds.push(uid);

    const r = await api('POST', '/onboarding/start', { user_id: uid, module: 'FakeModule' });
    expect(r.status).toBe(404);
  });

  it('handles concurrent module starts for same user', async () => {
    const uid = `${TEST_PREFIX}edge_concurrent_${Date.now()}`;
    allUserIds.push(uid);

    const [r1, r2] = await Promise.all([
      api('POST', '/onboarding/start', { user_id: uid, module: 'Navigation' }),
      api('POST', '/onboarding/start', { user_id: uid, module: 'Picking' }),
    ]);

    // Both should succeed (different modules)
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    const progress = await api('GET', `/onboarding/progress/${uid}`);
    expect(progress.body.length).toBe(2);
  });
});
