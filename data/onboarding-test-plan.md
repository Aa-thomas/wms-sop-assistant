# Onboarding Flow Test Plan

Manual testing strategy for all 9 WMS onboarding modules (42 steps total).
Every step must be verified end-to-end: start → explanation → quiz → advance.

**Test user ID:** `test_onboarding_user`
**Base URL:** `http://localhost:3000`

---

## How to Use This Document

For each step, run the API calls in order and verify the expected output.
Mark each checkbox as you go. If a step fails, note the failure inline.

### Per-Step Test Sequence

Every step follows the same 6-check sequence:

1. **START** — `POST /onboarding/start` (only for step 1 of each module)
2. **LOAD** — `POST /onboarding/step` → verify explanation, quick_tip, common_mistake, citations
3. **QUIZ CORRECT** — `POST /onboarding/validate-answer` with a good answer → expect `is_correct: true`
4. **QUIZ INCORRECT** — `POST /onboarding/validate-answer` with a bad answer → expect `is_correct: false`
5. **QUIZ MAX ATTEMPTS** — Verify `can_proceed: true` after 3 failed attempts
6. **ADVANCE** — `POST /onboarding/complete-step` → verify next step loads (or module complete)

### Grading Criteria for Explanations

Every explanation response must:
- [ ] Contain inline citations like `(Doc_Title - Slide N)`
- [ ] Reference actual SOP content (not generic knowledge)
- [ ] Include a `quick_tip` that is practical and step-specific
- [ ] Include a `common_mistake` (can be null but should usually be present)
- [ ] Return at least 1 citation with valid `doc_title`, `slide_number`, `source_locator`
- [ ] Be written in a friendly, first-week training tone

---

## Pre-Test Setup

```bash
# 1. Ensure DB is running and seeded
psql -d wms_sop -c "SELECT module, COUNT(*) FROM onboarding_curriculum GROUP BY module ORDER BY module;"
# Expected: 9 modules, step counts: Admin=5, CycleCounts=5, Inbound=4, Inventory=5, Navigation=4, Outbound=4, Picking=5, Replenishment=4, Returns=3

# 2. Clear test user progress (fresh start)
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_onboarding_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_onboarding_user';"

# 3. Verify server is running
curl -s http://localhost:3000/onboarding/available | jq '.[] | .module'
# Expected: All 9 module names
```

---

## Module 1: Navigation (4 steps)

### Step 1: Logging In & Launching the WMS

**1.1 START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation"}' | jq .
```
- [ ] `status` is `"started"`
- [ ] `step.step_number` is `1`
- [ ] `step.step_title` is `"Logging In & Launching the WMS"`
- [ ] `step.total_steps` is `4`
- [ ] `step.completed_count` is `0`

**1.2 LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation"}' | jq .
```
- [ ] `step_number` is `1`
- [ ] `explanation` mentions login steps, WMS portal, credentials, or URL
- [ ] `explanation` contains at least one inline citation `(... - Slide N)`
- [ ] `quick_tip` is a non-empty string with practical login advice
- [ ] `common_mistake` is present (e.g., forgetting password reset, wrong URL)
- [ ] `checkpoint` is `"What are the steps to log in and launch the WMS?"`
- [ ] `citations` array has at least 1 entry with `doc_title`, `slide_number`, `source_locator`
- [ ] `citations[].relevance` describes why the source is relevant

**1.3 QUIZ — CORRECT ANSWER**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_onboarding_user",
    "module":"Navigation",
    "step_number":1,
    "user_answer":"Navigate to the WMS portal URL, enter your username and password on the login screen, then click the WMS application link to launch it."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `feedback` is encouraging and confirms correctness
- [ ] `can_proceed` is `true`
- [ ] `attempts` is `1`

**1.4 ADVANCE TO STEP 2**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation","step_number":1}' | jq .
```
- [ ] `completed` is `false` (more steps remain)
- [ ] `next_step.step_number` is `2`
- [ ] `next_step.step_title` is `"Portal Layout & Menu Navigation"`
- [ ] `next_step.completed_count` is `1`

---

### Step 2: Portal Layout & Menu Navigation

**2.1 LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions portal areas, menu bar, main navigation sections
- [ ] `explanation` contains inline citations
- [ ] `quick_tip` is present
- [ ] `checkpoint` is `"What are the main areas of the WMS portal?"`
- [ ] `citations` array is non-empty

**2.2 QUIZ — CORRECT ANSWER**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_onboarding_user",
    "module":"Navigation",
    "step_number":2,
    "user_answer":"The main areas include the menu bar at the top for navigating between modules, the main content area where you work with records, and the status bar that shows current context information."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**2.3 ADVANCE TO STEP 3**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`
- [ ] `next_step.step_title` is `"Search & Resource Views"`
- [ ] `next_step.completed_count` is `2`

---

### Step 3: Search & Resource Views

**3.1 LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions search bar, resource views, search criteria, resource codes
- [ ] `explanation` contains inline citations
- [ ] `checkpoint` is `"How do you search for a specific record in the WMS?"`
- [ ] `citations` array is non-empty

**3.2 QUIZ — INCORRECT ANSWER (test retry flow)**
```bash
# Attempt 1 — vague answer
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_onboarding_user",
    "module":"Navigation",
    "step_number":3,
    "user_answer":"You just type something in the search box."
  }' | jq .
```
- [ ] `is_correct` is `false`
- [ ] `feedback` explains what was missing (e.g., search criteria, resource codes)
- [ ] `can_proceed` is `false`
- [ ] `attempts` is `1`

```bash
# Attempt 2 — still vague
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_onboarding_user",
    "module":"Navigation",
    "step_number":3,
    "user_answer":"Click the search button."
  }' | jq .
```
- [ ] `is_correct` is `false`
- [ ] `can_proceed` is `false`
- [ ] `attempts` is `2`

```bash
# Attempt 3 — still wrong, but max attempts reached
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_onboarding_user",
    "module":"Navigation",
    "step_number":3,
    "user_answer":"I am not sure."
  }' | jq .
```
- [ ] `is_correct` is `false`
- [ ] `can_proceed` is `true` (max attempts reached)
- [ ] `attempts` is `3`
- [ ] `max_attempts` is `3`

**3.3 ADVANCE TO STEP 4**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`
- [ ] `next_step.step_title` is `"Hot Keys & Personalizing Views"`
- [ ] `next_step.completed_count` is `3`

---

### Step 4: Hot Keys & Personalizing Views (FINAL)

**4.1 LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions hot keys, personalization, business views, bookmarks
- [ ] `checkpoint` is `"What hot keys can you use to work faster in the WMS?"`
- [ ] `citations` array is non-empty

**4.2 QUIZ — CORRECT ANSWER**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_onboarding_user",
    "module":"Navigation",
    "step_number":4,
    "user_answer":"Hot keys like F-keys let you quickly navigate between screens, save records, or perform common actions without using the mouse. You can also set up bookmarks and personalize your business views."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**4.3 COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation","step_number":4}' | jq .
```
- [ ] `completed` is `true`
- [ ] `message` contains "Congratulations" and "Navigation"
- [ ] `completed_steps` is `4`
- [ ] `total_steps` is `4`

**4.4 VERIFY PROGRESS**
```bash
curl -s http://localhost:3000/onboarding/progress/test_onboarding_user | jq '.[] | select(.module=="Navigation")'
```
- [ ] `status` is `"completed"`
- [ ] `completed_at` is not null
- [ ] `completed_count` is `4`

---

## Module 2: Picking (5 steps)

### Reset for fresh test
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_picking_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_picking_user';"
```

### Step 1: Navigation & RF Gun Basics

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking"}' | jq .
```
- [ ] `status` is `"started"`
- [ ] `step.step_number` is `1`
- [ ] `step.step_title` is `"Navigation & RF Gun Basics"`
- [ ] `step.total_steps` is `5`

**LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking"}' | jq .
```
- [ ] `explanation` mentions RF gun, navigation, picking screen access
- [ ] `explanation` contains inline citations
- [ ] `quick_tip` is present and RF gun/picking specific
- [ ] `common_mistake` is present
- [ ] `checkpoint` is `"Can you describe how to access the Picking screen?"`
- [ ] `citations` has at least 1 entry

**QUIZ — CORRECT**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_picking_user",
    "module":"Picking",
    "step_number":1,
    "user_answer":"Log into the WMS on the RF gun, navigate to the main menu, and select the Picking option to access the picking screen."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`
- [ ] `next_step.step_title` is `"Batch Picking Workflow"`

---

### Step 2: Batch Picking Workflow

**LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions batch picking process, steps, order, scanning
- [ ] `checkpoint` is `"What are the main steps in batch picking?"`
- [ ] `citations` is non-empty

**QUIZ — CORRECT**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_picking_user",
    "module":"Picking",
    "step_number":2,
    "user_answer":"The main steps are: get assigned a batch, go to the first pick location, scan the location barcode, scan the item, confirm the quantity, and repeat for each pick in the batch. Then close the batch when done."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`
- [ ] `next_step.step_title` is `"Short Pick Handling"`

---

### Step 3: Short Pick Handling

**LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions short pick, items not available, partial pick, how to handle
- [ ] `checkpoint` is `"What do you do if you encounter a short pick?"`
- [ ] `citations` is non-empty

**QUIZ — CORRECT**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_picking_user",
    "module":"Picking",
    "step_number":3,
    "user_answer":"When you encounter a short pick, you mark the item as short in the system, enter the actual quantity available, and notify your supervisor so they can investigate the discrepancy."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`
- [ ] `next_step.step_title` is `"Inventory Discrepancies"`

---

### Step 4: Inventory Discrepancies

**LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions inventory discrepancy, quantity mismatch, wrong location
- [ ] `checkpoint` is `"How do you handle an inventory discrepancy?"`
- [ ] `citations` is non-empty

**QUIZ — CORRECT**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_picking_user",
    "module":"Picking",
    "step_number":4,
    "user_answer":"Report the discrepancy in the system, note the expected vs actual quantity, check if the item might be in a nearby location, and notify your supervisor for review and correction."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking","step_number":4}' | jq .
```
- [ ] `next_step.step_number` is `5`
- [ ] `next_step.step_title` is `"End-of-Shift Procedures"`

---

### Step 5: End-of-Shift Procedures (FINAL)

**LOAD EXPLANATION**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking"}' | jq .
```
- [ ] `step_number` is `5`
- [ ] `explanation` mentions end of shift, close batch, shift completion procedures
- [ ] `checkpoint` is `"What are the key steps to complete at end of shift?"`
- [ ] `citations` is non-empty

**QUIZ — CORRECT**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_picking_user",
    "module":"Picking",
    "step_number":5,
    "user_answer":"At end of shift, close any open batches, log out of the RF gun, return equipment to the charging station, and report any unresolved issues to the next shift or supervisor."
  }' | jq .
```
- [ ] `is_correct` is `true`
- [ ] `can_proceed` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_picking_user","module":"Picking","step_number":5}' | jq .
```
- [ ] `completed` is `true`
- [ ] `message` contains "Congratulations" and "Picking"
- [ ] `completed_steps` is `5`
- [ ] `total_steps` is `5`

**VERIFY PROGRESS**
```bash
curl -s http://localhost:3000/onboarding/progress/test_picking_user | jq '.[] | select(.module=="Picking")'
```
- [ ] `status` is `"completed"`
- [ ] `completed_at` is not null

---

## Module 3: Outbound (4 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_outbound_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_outbound_user';"
```

### Step 1: Outbound Order Basics

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `4`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound"}' | jq .
```
- [ ] `explanation` mentions outbound order processing, order types, or allocation
- [ ] `checkpoint` is `"What is the first step in processing an outbound order?"`
- [ ] `citations` is non-empty

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_outbound_user",
    "module":"Outbound",
    "step_number":1,
    "user_answer":"The first step is to review the outbound order in the system, verify the order details including items and quantities, and then allocate the order for picking."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"Order Allocation"`

---

### Step 2: Order Allocation

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions order allocation, allocation screen, assigning orders
- [ ] `checkpoint` is `"How do you allocate an order?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_outbound_user",
    "module":"Outbound",
    "step_number":2,
    "user_answer":"Open the allocation screen, select the orders to allocate, verify inventory availability, and run the allocation process to assign inventory to the order lines."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Packing Process"`

---

### Step 3: Packing Process

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions packing, pack order, packing station procedures
- [ ] `checkpoint` is `"What are the steps to pack an order?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_outbound_user",
    "module":"Outbound",
    "step_number":3,
    "user_answer":"At the packing station, scan the order or container barcode, verify the items match the order, pack items into the appropriate shipping container, and confirm the pack is complete in the system."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`, `next_step.step_title` is `"Shipping Label Generation"`

---

### Step 4: Shipping Label Generation (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions shipping labels, generating, printing
- [ ] `checkpoint` is `"How do you generate a shipping label?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_outbound_user",
    "module":"Outbound",
    "step_number":4,
    "user_answer":"After packing is confirmed, navigate to the shipping screen, select the packed container, generate the label which pulls carrier and address info, then print and apply the label to the package."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_outbound_user","module":"Outbound","step_number":4}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `4`, `total_steps` is `4`

---

## Module 4: Inbound (4 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_inbound_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_inbound_user';"
```

### Step 1: Receiving Overview

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `4`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound"}' | jq .
```
- [ ] `explanation` mentions receiving process, inbound order, receiving shipment
- [ ] `checkpoint` is `"What is the first step when receiving an inbound shipment?"`
- [ ] `citations` is non-empty

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inbound_user",
    "module":"Inbound",
    "step_number":1,
    "user_answer":"The first step is to verify the inbound order exists in the system, check the PO number against the shipment, and then begin the receiving process by scanning or entering the PO."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"Quantity Verification"`

---

### Step 2: Quantity Verification

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions quantity verification, counting items, PO matching
- [ ] `checkpoint` is `"What do you do if quantities don't match the PO?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inbound_user",
    "module":"Inbound",
    "step_number":2,
    "user_answer":"If quantities dont match the PO, record the actual count received, flag the discrepancy in the system, and notify the receiving supervisor for resolution with the supplier."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Quality Inspection"`

---

### Step 3: Quality Inspection

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions quality inspection, damaged goods, defective items
- [ ] `checkpoint` is `"How do you handle damaged items during receiving?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inbound_user",
    "module":"Inbound",
    "step_number":3,
    "user_answer":"Separate damaged items from good inventory, mark them as damaged in the system, place them in the designated hold or damage area, and document the damage for the supplier claim."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`, `next_step.step_title` is `"Put-Away Process"`

---

### Step 4: Put-Away Process (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions put-away, storing items, inventory locations
- [ ] `checkpoint` is `"What are the steps for putting away received items?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inbound_user",
    "module":"Inbound",
    "step_number":4,
    "user_answer":"After receiving is complete, the system directs you to a put-away location. Scan the location barcode, scan the item, confirm the quantity, and complete the put-away task to update inventory."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inbound_user","module":"Inbound","step_number":4}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `4`, `total_steps` is `4`

---

## Module 5: Replenishment (4 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_replen_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_replen_user';"
```

### Step 1: System-Directed Replenishment

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `4`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment"}' | jq .
```
- [ ] `explanation` mentions system-directed replenishment, mobile device, replenishment tasks
- [ ] `checkpoint` is `"How does system-directed replenishment work on your mobile device?"`
- [ ] `citations` is non-empty

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_replen_user",
    "module":"Replenishment",
    "step_number":1,
    "user_answer":"The system automatically sends replenishment tasks to your mobile device. You receive a task showing the source location and destination, pick the items from the source, and move them to the forward pick location."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"Replenish by Section & Area"`

---

### Step 2: Replenish by Section & Area

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions replenish by section, replenish by area, manual trigger
- [ ] `checkpoint` is `"When would you use replenish by section vs replenish by area?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_replen_user",
    "module":"Replenishment",
    "step_number":2,
    "user_answer":"Replenish by section is used when you want to replenish all locations within a specific picking section. Replenish by area covers a broader warehouse area and is used for larger-scale replenishment needs."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Replenish by Location"`

---

### Step 3: Replenish by Location

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions replenishing a specific location
- [ ] `checkpoint` is `"How do you replenish a specific location?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_replen_user",
    "module":"Replenishment",
    "step_number":3,
    "user_answer":"Select the replenish by location option, enter the specific location code that needs replenishment, and the system will create a task to move inventory from the reserve area to that location."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`, `next_step.step_title` is `"Wave Replenishment Management"`

---

### Step 4: Wave Replenishment Management (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions wave replenishment, desktop management
- [ ] `checkpoint` is `"What is wave replenishment and how do you manage it from the desktop?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_replen_user",
    "module":"Replenishment",
    "step_number":4,
    "user_answer":"Wave replenishment runs replenishment tasks for all items needed by a wave of orders. From the desktop, you can view wave status, trigger wave replenishment, monitor progress, and manage exceptions."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_replen_user","module":"Replenishment","step_number":4}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `4`, `total_steps` is `4`

---

## Module 6: Inventory (5 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_inventory_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_inventory_user';"
```

### Step 1: Store & Put-Away

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `5`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory"}' | jq .
```
- [ ] `explanation` mentions storing items, put-away, designated locations
- [ ] `checkpoint` is `"What are the steps to put away inventory into a location?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inventory_user",
    "module":"Inventory",
    "step_number":1,
    "user_answer":"Scan the item or container, the system suggests a put-away location, navigate to that location, scan the location barcode to confirm, and complete the put-away to update inventory records."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"Inventory Move & Relocation"`

---

### Step 2: Inventory Move & Relocation

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions inventory move, relocation, differences between them
- [ ] `checkpoint` is `"What is the difference between an inventory move and a relocation?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inventory_user",
    "module":"Inventory",
    "step_number":2,
    "user_answer":"An inventory move transfers items from one location to another within the warehouse. A relocation changes the designated home or assigned location for an item, updating where the system expects it to be stored."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Inventory Adjustments"`

---

### Step 3: Inventory Adjustments

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions inventory adjustments, quantity discrepancies
- [ ] `checkpoint` is `"When and how do you make an inventory adjustment?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inventory_user",
    "module":"Inventory",
    "step_number":3,
    "user_answer":"You make an inventory adjustment when a cycle count or physical check reveals a discrepancy. Enter the adjustment screen, select the item and location, enter the correct quantity, provide a reason code, and submit for approval."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`, `next_step.step_title` is `"Inventory Status Modification"`

---

### Step 4: Inventory Status Modification

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions status modification, hold, release, damage status
- [ ] `checkpoint` is `"How do you change the status of inventory in the WMS?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inventory_user",
    "module":"Inventory",
    "step_number":4,
    "user_answer":"Navigate to the inventory status screen, search for the item, select the new status such as hold, damage, or available, provide a reason code, and confirm the change."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory","step_number":4}' | jq .
```
- [ ] `next_step.step_number` is `5`, `next_step.step_title` is `"Item UOM & Volumetrics"`

---

### Step 5: Item UOM & Volumetrics (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory"}' | jq .
```
- [ ] `step_number` is `5`
- [ ] `explanation` mentions UOM, unit of measure, volumetrics, item maintenance
- [ ] `checkpoint` is `"Why is it important to have correct UOM and volumetric data?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_inventory_user",
    "module":"Inventory",
    "step_number":5,
    "user_answer":"Correct UOM and volumetric data ensures accurate picking, packing, and shipping. Wrong data leads to incorrect quantities, improper container selection, and shipping cost errors."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_inventory_user","module":"Inventory","step_number":5}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `5`, `total_steps` is `5`

---

## Module 7: CycleCounts (5 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_cc_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_cc_user';"
```

### Step 1: Creating a Planned Cycle Count

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `5`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts"}' | jq .
```
- [ ] `explanation` mentions creating planned cycle count, task assignment
- [ ] `checkpoint` is `"How do you create a planned cycle count?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_cc_user",
    "module":"CycleCounts",
    "step_number":1,
    "user_answer":"Navigate to the cycle count screen, define the count criteria such as locations or items to count, set the schedule, assign it to a team member, and release the count task."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"System-Directed Cycle Count"`

---

### Step 2: System-Directed Cycle Count

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions system-directed count, mobile device usage
- [ ] `checkpoint` is `"How does a system-directed cycle count work on the mobile device?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_cc_user",
    "module":"CycleCounts",
    "step_number":2,
    "user_answer":"The system sends a count task to your mobile device. You go to the directed location, scan the location barcode, count the items physically, enter the quantity on the device, and confirm the count."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Cycle Count by Order"`

---

### Step 3: Cycle Count by Order

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions cycle count by order, counting for a specific order
- [ ] `checkpoint` is `"When would you use cycle count by order?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_cc_user",
    "module":"CycleCounts",
    "step_number":3,
    "user_answer":"Cycle count by order is used when there is a discrepancy on a specific order, such as a short pick, and you need to verify the inventory at the locations associated with that order."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`, `next_step.step_title` is `"Demand Cycle Count"`

---

### Step 4: Demand Cycle Count

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions demand cycle count, triggered by discrepancies
- [ ] `checkpoint` is `"What triggers a demand cycle count?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_cc_user",
    "module":"CycleCounts",
    "step_number":4,
    "user_answer":"A demand cycle count is triggered when the system detects a discrepancy, such as a short pick or a zero-quantity scan, requiring immediate verification of inventory at that location."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts","step_number":4}' | jq .
```
- [ ] `next_step.step_number` is `5`, `next_step.step_title` is `"Cycle Count Exceptions & Approval"`

---

### Step 5: Cycle Count Exceptions & Approval (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts"}' | jq .
```
- [ ] `step_number` is `5`
- [ ] `explanation` mentions exceptions, approval process, handling discrepancies
- [ ] `checkpoint` is `"How do you handle exceptions found during a cycle count?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_cc_user",
    "module":"CycleCounts",
    "step_number":5,
    "user_answer":"When exceptions are found, review the variance report, investigate the cause of the discrepancy, recount if necessary, and submit the results for supervisor approval. The supervisor then approves or rejects the adjustment."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_cc_user","module":"CycleCounts","step_number":5}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `5`, `total_steps` is `5`

---

## Module 8: Returns (3 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_returns_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_returns_user';"
```

### Step 1: Return Authorization & Prerequisites

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `3`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns"}' | jq .
```
- [ ] `explanation` mentions RMA, return authorization, prerequisites
- [ ] `checkpoint` is `"What must be in place before you can process a customer return?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_returns_user",
    "module":"Returns",
    "step_number":1,
    "user_answer":"Before processing a return, you need a valid RMA (Return Merchandise Authorization) number. The return must be authorized and the RMA entered in the system before the warehouse can receive the items back."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"Inbound Return Planning"`

---

### Step 2: Inbound Return Planning

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions inbound return planning, creating return order
- [ ] `checkpoint` is `"What are the steps to plan an inbound return?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_returns_user",
    "module":"Returns",
    "step_number":2,
    "user_answer":"Create an inbound return order in the system referencing the RMA, specify the expected items and quantities, set the expected arrival date, and release the order so receiving knows to expect the return."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Receiving a Return"`

---

### Step 3: Receiving a Return (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions receiving returns, serial numbers, partial receipts
- [ ] `checkpoint` is `"How do you receive a customer return, and what do you do with serial-numbered items?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_returns_user",
    "module":"Returns",
    "step_number":3,
    "user_answer":"Open the return order, scan or enter the items being returned, verify quantities against the RMA. For serial-numbered items, scan each serial number individually to track them. If not all items arrive, process a partial receipt for what was received."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_returns_user","module":"Returns","step_number":3}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `3`, `total_steps` is `3`

---

## Module 9: Admin (5 steps)

### Reset
```bash
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id = 'test_admin_user';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id = 'test_admin_user';"
```

### Step 1: WMS User Management

**START**
```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin"}' | jq .
```
- [ ] `status` is `"started"`, `step.step_number` is `1`, `step.total_steps` is `5`

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin"}' | jq .
```
- [ ] `explanation` mentions user management, creating users, modifying users
- [ ] `checkpoint` is `"How do you create a new WMS user?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_admin_user",
    "module":"Admin",
    "step_number":1,
    "user_answer":"Go to the user management screen, click create new user, enter the username, assign the appropriate role and permissions, set the initial password, and activate the account."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin","step_number":1}' | jq .
```
- [ ] `next_step.step_number` is `2`, `next_step.step_title` is `"Warehouse Setup Overview"`

---

### Step 2: Warehouse Setup Overview

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin"}' | jq .
```
- [ ] `step_number` is `2`
- [ ] `explanation` mentions warehouse setup, configuration options
- [ ] `checkpoint` is `"What are the key settings in warehouse setup?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_admin_user",
    "module":"Admin",
    "step_number":2,
    "user_answer":"Key settings include warehouse code and name, address configuration, default receiving and shipping options, inventory tracking parameters, and system-level options like auto-allocation and wave management settings."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin","step_number":2}' | jq .
```
- [ ] `next_step.step_number` is `3`, `next_step.step_title` is `"Hold Codes & Container Types"`

---

### Step 3: Hold Codes & Container Types

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin"}' | jq .
```
- [ ] `step_number` is `3`
- [ ] `explanation` mentions hold codes, container types, container selection codes
- [ ] `checkpoint` is `"What are hold codes used for in the WMS?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_admin_user",
    "module":"Admin",
    "step_number":3,
    "user_answer":"Hold codes are used to restrict inventory from being picked or shipped. They mark inventory as unavailable for specific reasons like quality hold, damage, or pending inspection, preventing it from being allocated to orders."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin","step_number":3}' | jq .
```
- [ ] `next_step.step_number` is `4`, `next_step.step_title` is `"Areas & Picking Sections"`

---

### Step 4: Areas & Picking Sections

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin"}' | jq .
```
- [ ] `step_number` is `4`
- [ ] `explanation` mentions warehouse areas, picking sections, configuration
- [ ] `checkpoint` is `"How are warehouse areas and picking sections configured?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_admin_user",
    "module":"Admin",
    "step_number":4,
    "user_answer":"Warehouse areas are defined to organize the warehouse into zones like receiving, storage, and shipping. Picking sections are configured within areas to group pick locations, control replenishment, and optimize picker routes."
  }' | jq .
```
- [ ] `is_correct` is `true`

**ADVANCE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin","step_number":4}' | jq .
```
- [ ] `next_step.step_number` is `5`, `next_step.step_title` is `"Item Load & Label Management"`

---

### Step 5: Item Load & Label Management (FINAL)

**LOAD**
```bash
curl -s -X POST http://localhost:3000/onboarding/step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin"}' | jq .
```
- [ ] `step_number` is `5`
- [ ] `explanation` mentions item load, UOM settings, label configurations
- [ ] `checkpoint` is `"What is the item load process and why is it important?"`

**QUIZ**
```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_admin_user",
    "module":"Admin",
    "step_number":5,
    "user_answer":"The item load process imports item master data into the WMS including SKU details, UOM conversions, and volumetrics. Its important because accurate item data drives correct picking, packing, storage allocation, and label generation."
  }' | jq .
```
- [ ] `is_correct` is `true`

**COMPLETE MODULE**
```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_admin_user","module":"Admin","step_number":5}' | jq .
```
- [ ] `completed` is `true`
- [ ] `completed_steps` is `5`, `total_steps` is `5`

---

## Cross-Module Verification Tests

### Test A: Resume In-Progress Module

```bash
# Start a module, complete step 1, then call start again
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_resume_user","module":"Navigation"}' | jq .
# Complete step 1...
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_resume_user","module":"Navigation","step_number":1}' | jq .
# Now call start again — should resume at step 2
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_resume_user","module":"Navigation"}' | jq .
```
- [ ] `status` is `"resumed"` (not `"started"`)
- [ ] `step.step_number` is `2`
- [ ] `step.completed_count` is `1`

### Test B: Restart Completed Module

```bash
# After completing Navigation module, call start again
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_onboarding_user","module":"Navigation"}' | jq .
```
- [ ] `status` is `"already_completed"`

### Test C: Multi-Module Progress

```bash
curl -s http://localhost:3000/onboarding/progress/test_onboarding_user | jq .
```
- [ ] Returns array with Navigation module entry
- [ ] Navigation shows `status: "completed"`, `completed_count: 4`

### Test D: Supervisor Dashboard Reflects All Test Users

```bash
curl -s http://localhost:3000/onboarding/supervisor/dashboard | jq .
```
- [ ] Contains entries for all test users who completed modules
- [ ] Completed users show `status: "Completed"` and `completion_percentage: 100`

### Test E: Supervisor Summary Aggregation

```bash
curl -s http://localhost:3000/onboarding/supervisor/summary | jq .
```
- [ ] Each module with test data shows correct `completed_users` count
- [ ] `total_users` reflects actual started count

### Test F: Supervisor User Detail

```bash
curl -s http://localhost:3000/onboarding/supervisor/user/test_picking_user | jq .
```
- [ ] Shows Picking module with `completed_steps: [1,2,3,4,5]`
- [ ] `completed_at` is not null
- [ ] `total_steps` is `5`

---

## Edge Case Tests

### Edge 1: Empty Answer Submission

```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"test_edge_user",
    "module":"Navigation",
    "step_number":1,
    "user_answer":""
  }' | jq .
```
- [ ] Returns error or `is_correct: false` (should not crash)

### Edge 2: Invalid Module Name

```bash
curl -s -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_edge_user","module":"FakeModule"}' | jq .
```
- [ ] Returns error message (not a 500)

### Edge 3: Skip Step (Complete Step 3 When On Step 1)

```bash
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_edge_user","module":"Navigation","step_number":3}' | jq .
```
- [ ] Returns error or is safely handled (no data corruption)

### Edge 4: Duplicate Complete-Step Call

```bash
# Complete step 1 twice in a row
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_edge_user","module":"Navigation","step_number":1}' | jq .
curl -s -X POST http://localhost:3000/onboarding/complete-step \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_edge_user","module":"Navigation","step_number":1}' | jq .
```
- [ ] Second call is idempotent or returns appropriate message
- [ ] Progress is not corrupted (step 1 not counted twice)

### Edge 5: Very Long Quiz Answer

```bash
curl -s -X POST http://localhost:3000/onboarding/validate-answer \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\":\"test_edge_user\",
    \"module\":\"Navigation\",
    \"step_number\":1,
    \"user_answer\":\"$(python3 -c "print('A' * 5000)")\"
  }" | jq .
```
- [ ] Returns a response (not a 500 or timeout)

---

## Cleanup

```bash
# Remove all test user data after testing
psql -d wms_sop -c "DELETE FROM onboarding_quiz_attempts WHERE user_id LIKE 'test_%';"
psql -d wms_sop -c "DELETE FROM onboarding_progress WHERE user_id LIKE 'test_%';"
```

---

## Summary Scorecard

| Module | Steps | All Explanations Grounded | All Quizzes Pass | Module Completes | Progress Tracked |
|--------|-------|--------------------------|-----------------|-----------------|-----------------|
| Navigation | 4 | [ ] | [ ] | [ ] | [ ] |
| Picking | 5 | [ ] | [ ] | [ ] | [ ] |
| Outbound | 4 | [ ] | [ ] | [ ] | [ ] |
| Inbound | 4 | [ ] | [ ] | [ ] | [ ] |
| Replenishment | 4 | [ ] | [ ] | [ ] | [ ] |
| Inventory | 5 | [ ] | [ ] | [ ] | [ ] |
| CycleCounts | 5 | [ ] | [ ] | [ ] | [ ] |
| Returns | 3 | [ ] | [ ] | [ ] | [ ] |
| Admin | 5 | [ ] | [ ] | [ ] | [ ] |
| **Cross-module** | 6 | — | — | — | [ ] |
| **Edge cases** | 5 | — | — | — | [ ] |

**Total test checks: ~250+**
