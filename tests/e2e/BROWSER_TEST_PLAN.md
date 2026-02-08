# Browser UI Test Plan — Feedback Learning Loop

Interactive browser tests using Playwright MCP tools. Run these with the app live (`npm run dev`).

## Prerequisites
- `docker compose up -d` (Postgres with pgvector)
- `psql -f scripts/migrate_feedback_loop.sql` (create tables)
- `npm run dev` (backend :3000, frontend :5173)
- Data ingested (at least a few chunks in the DB)

---

## Test 1: Ask a Question — Verify interaction_id

**Steps:**
1. `browser_navigate` → `http://localhost:5173`
2. `browser_snapshot` → verify search bar is visible
3. `browser_type` into search input → "How do I log in to the WMS?"
4. `browser_click` the Ask / Submit button
5. `browser_wait_for` → wait for answer text to appear
6. `browser_snapshot` → capture the answer state

**Assertions:**
- Answer claims are rendered as a list
- "Was this helpful?" text is visible
- Thumbs up (👍) and thumbs down (👎) buttons are visible
- Both buttons are enabled (not disabled)

**Backend check:**
- `browser_network_requests` → verify POST /ask returned 200
- Response body contains `interaction_id` (number)

---

## Test 2: Thumbs Up — Immediate Submit + Golden Promotion

**Steps:**
1. (Continuing from Test 1)
2. `browser_click` the thumbs-up button
3. `browser_snapshot` → verify state change

**Assertions:**
- Thumbs-up button gets `selected` class (visual highlight)
- Both buttons become disabled
- Toast notification "Thanks for your feedback!" appears
- No comment input appears

**Backend check:**
- `browser_network_requests` → verify POST /feedback sent with `{ interaction_id: N, helpful: true }`
- Query DB: `SELECT helpful FROM interactions WHERE id = N` → `true`
- Query DB: `SELECT COUNT(*) FROM golden_answers WHERE interaction_id = N` → `1`

---

## Test 3: Thumbs Down — Comment Input Flow

**Steps:**
1. `browser_navigate` → `http://localhost:5173` (fresh state)
2. Ask a new question (type + submit)
3. Wait for answer
4. `browser_click` the thumbs-down button
5. `browser_snapshot` → verify comment input appeared

**Assertions (after clicking thumbs-down):**
- Thumbs-down button gets `selected` class
- Both buttons become disabled
- A text input appears with placeholder "What was wrong? (optional)"
- A "Submit" button appears next to the input

**Steps (continued):**
6. `browser_type` into comment input → "The procedure was for the wrong module"
7. `browser_click` the Submit button (or press Enter)
8. `browser_snapshot` → verify comment form dismissed

**Assertions (after submitting comment):**
- Comment input disappears
- Toast "Thanks for your feedback!" appears

**Backend check:**
- POST /feedback sent with `{ interaction_id: N, helpful: false, comment: "The procedure was for the wrong module" }`
- `SELECT comment FROM interactions WHERE id = N` → matches

---

## Test 4: Thumbs Down — Skip Comment (Submit Empty)

**Steps:**
1. Ask a question, wait for answer
2. Click thumbs-down
3. Click Submit immediately (without typing a comment)

**Assertions:**
- Feedback submitted with `comment: null`
- Toast appears
- No error

---

## Test 5: No Feedback Buttons When interaction_id Missing

**Steps:**
1. This scenario occurs if interaction logging fails (DB error)
2. In the React component, `FeedbackButtons` returns `null` when `interactionId` is falsy
3. Verify by inspecting: if a response has no `interaction_id`, "Was this helpful?" should not appear

**How to test manually:**
- Temporarily break the interactions INSERT (e.g., drop the table)
- Ask a question — answer should still render
- Feedback buttons should NOT appear

---

## Test 6: Golden Answer Injection (Server Logs)

**Steps:**
1. Ask a question and give it a thumbs-up (creates golden answer)
2. Ask a very similar question
3. Check server console logs

**Assertions:**
- Server log should show: `[GOLDEN] Found match (similarity=0.9XX): "original question"`
- The answer quality should be comparable (golden example influences prompt)

---

## Test 7: Onboarding Still Works

**Steps:**
1. Click "Start Onboarding" button
2. Select a module
3. Verify step content loads with explanation, tips, checkpoint

**Assertions:**
- No errors in console
- Step content renders correctly
- The `retrieve()` return format change didn't break onboarding

---

## Test 8: Page Responsiveness

**Steps:**
1. `browser_resize` → { width: 375, height: 667 } (mobile)
2. Ask a question, wait for answer
3. Click thumbs-down
4. `browser_snapshot` → verify comment input fits on mobile

**Assertions:**
- Comment input is full-width
- Submit button is visible without horizontal scroll
- Feedback buttons don't overflow

---

## Cleanup

After all tests:
```sql
DELETE FROM golden_answers WHERE source = 'thumbs_up' AND created_at > NOW() - INTERVAL '1 hour';
DELETE FROM interactions WHERE created_at > NOW() - INTERVAL '1 hour';
```
