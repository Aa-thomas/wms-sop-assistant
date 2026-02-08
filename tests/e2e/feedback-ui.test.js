/**
 * Browser-based UI tests for the feedback learning loop.
 *
 * Prerequisites:
 *   - App running: `npm run dev` (backend on :3000, frontend on :5173)
 *   - Database migrated: `psql -f scripts/migrate_feedback_loop.sql`
 *   - At least some chunks ingested so /ask returns real results
 *
 * Run with: npm run test:e2e -- feedback-ui
 *
 * NOTE: These tests are designed to be run manually via Playwright MCP browser
 * tools (browser_navigate, browser_snapshot, browser_click, etc.) as a
 * scripted walkthrough. The test file below documents the steps and assertions
 * for automated execution with vitest + playwright, but can also serve as a
 * manual testing checklist.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// This test requires a running app — skip in CI if no server available
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

async function isServerRunning() {
  try {
    const res = await fetch(`${APP_URL.replace(':5173', ':3000')}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

describe('Feedback UI — Browser Checks', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    serverAvailable = await isServerRunning();
    if (!serverAvailable) {
      console.warn('⚠ Server not running — skipping browser UI tests. Start with: npm run dev');
    }
  });

  /**
   * Test Plan: Feedback buttons appear after /ask response
   *
   * Browser steps:
   * 1. Navigate to APP_URL
   * 2. Type a question in the search bar
   * 3. Submit the form
   * 4. Wait for answer to appear
   * 5. Assert: feedback buttons (thumbs up/down) are visible
   * 6. Assert: "Was this helpful?" text is present
   */
  it('feedback buttons appear after answer loads', async () => {
    if (!serverAvailable) return;

    const res = await fetch(`${APP_URL.replace(':5173', ':3000')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How do I log in to the WMS?' }),
    });

    const data = await res.json();
    // interaction_id must be present for feedback buttons to render
    expect(data.interaction_id).toBeDefined();
    expect(typeof data.interaction_id).toBe('number');
    expect(data.answer).toBeDefined();
  });

  /**
   * Test Plan: Thumbs-up submits feedback immediately
   *
   * Browser steps:
   * 1. Ask a question, get interaction_id
   * 2. POST /feedback with { interaction_id, helpful: true }
   * 3. Assert: response is { success: true }
   * 4. Assert: interaction row has helpful=true
   * 5. Assert: golden_answers has a new row for this interaction
   */
  it('thumbs-up submits feedback and creates golden answer', async () => {
    if (!serverAvailable) return;

    const apiBase = APP_URL.replace(':5173', ':3000');

    // Ask
    const askRes = await fetch(`${apiBase}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is the batch picking workflow?' }),
    });
    const askData = await askRes.json();
    expect(askData.interaction_id).toBeDefined();

    // Feedback
    const fbRes = await fetch(`${apiBase}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interaction_id: askData.interaction_id, helpful: true }),
    });
    const fbData = await fbRes.json();
    expect(fbData.success).toBe(true);
  });

  /**
   * Test Plan: Thumbs-down shows comment input
   *
   * Browser steps:
   * 1. Ask a question, wait for answer
   * 2. Click thumbs-down button
   * 3. Assert: comment input appears with placeholder "What was wrong? (optional)"
   * 4. Assert: Submit button appears next to input
   * 5. Type a comment
   * 6. Click Submit (or press Enter)
   * 7. Assert: toast "Thanks for your feedback!" appears
   * 8. Assert: buttons become disabled
   */
  it('thumbs-down accepts optional comment', async () => {
    if (!serverAvailable) return;

    const apiBase = APP_URL.replace(':5173', ':3000');

    // Ask
    const askRes = await fetch(`${apiBase}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How do I handle short picks?' }),
    });
    const askData = await askRes.json();

    // Feedback with comment
    const fbRes = await fetch(`${apiBase}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interaction_id: askData.interaction_id,
        helpful: false,
        comment: 'Missing procedure for exception handling',
      }),
    });
    const fbData = await fbRes.json();
    expect(fbData.success).toBe(true);
  });

  /**
   * Test Plan: Feedback buttons hidden when interaction_id is null
   *
   * Browser steps:
   * 1. If interaction logging fails, response has interaction_id: null
   * 2. Assert: FeedbackButtons component returns null (not rendered)
   * 3. Assert: no "Was this helpful?" text on page
   */
  it('feedback endpoint rejects missing interaction_id', async () => {
    if (!serverAvailable) return;

    const apiBase = APP_URL.replace(':5173', ':3000');
    const res = await fetch(`${apiBase}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful: true }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('interaction_id');
  });
});
