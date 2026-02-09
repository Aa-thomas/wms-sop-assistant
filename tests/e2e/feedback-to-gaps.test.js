/**
 * E2E Test: Unhelpful Feedback → Supervisor Dashboard (Knowledge Gaps) Pipeline
 *
 * Verifies the full data flow: operator marks answers as "unhelpful" (thumbs-down
 * with comment) → gap analysis clusters them → supervisor dashboard surfaces gaps
 * in both the Briefing tab and the Knowledge Gaps tab.
 *
 * Prerequisites:
 *   - App running: `npm run dev` (backend on :3000, frontend on :5173)
 *   - Database migrated (including `migrate_gap_analysis.sql`)
 *   - At least some chunks ingested so /ask returns results
 *   - A supervisor user account exists (e.g., "supervisor" / "supervisor")
 *
 * Run with: npm run test:e2e -- feedback-to-gaps
 *
 * NOTE: Browser steps are documented for manual walkthrough with Playwright MCP
 * tools. The vitest assertions cover the API layer; browser assertions are
 * documented as comments for the MCP-driven walkthrough.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_BASE = APP_URL.replace(':5173', ':3000');

// Supervisor credentials — adjust if your dev DB differs
const SUPERVISOR_USER = process.env.TEST_SUPERVISOR_USER || 'aaron';
const SUPERVISOR_PASS = process.env.TEST_SUPERVISOR_PASS || 'test123';

// Seeded questions targeting a narrow topic likely to cluster
const SEED_QUESTIONS = [
  'How do I handle damaged goods during receiving?',
  'What is the procedure for damaged items at inbound dock?',
  'How to process damaged inventory on arrival?',
];
const SEED_COMMENT = 'Missing procedure for handling damaged goods at receiving';

async function isServerRunning() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function loginAsSupervisor() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SUPERVISOR_USER, password: SUPERVISOR_PASS }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

describe('Feedback → Supervisor Dashboard Pipeline', () => {
  let serverAvailable = false;
  let token = null;
  const interactionIds = [];

  beforeAll(async () => {
    serverAvailable = await isServerRunning();
    if (!serverAvailable) {
      console.warn('⚠ Server not running — skipping E2E tests. Start with: npm run dev');
      return;
    }
    token = await loginAsSupervisor();
  });

  // ─── Step 1: Seed unhelpful feedback via API ────────────────────────

  it('seeds unhelpful feedback for similar questions', async () => {
    if (!serverAvailable) return;

    for (const question of SEED_QUESTIONS) {
      // Ask
      const askRes = await fetch(`${API_BASE}/ask`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ question }),
      });
      expect(askRes.ok).toBe(true);
      const askData = await askRes.json();
      expect(askData.interaction_id).toBeDefined();
      interactionIds.push(askData.interaction_id);

      // Thumbs-down with comment
      const fbRes = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          interaction_id: askData.interaction_id,
          helpful: false,
          comment: SEED_COMMENT,
        }),
      });
      const fbData = await fbRes.json();
      expect(fbData.success).toBe(true);
    }

    expect(interactionIds.length).toBe(SEED_QUESTIONS.length);
  });

  // ─── Step 2: Trigger gap analysis via API ───────────────────────────

  it('gap analysis finds at least one gap from seeded feedback', async () => {
    if (!serverAvailable) return;

    const analyzeRes = await fetch(`${API_BASE}/gaps/analyze`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ period_days: 30 }),
    });
    expect(analyzeRes.ok).toBe(true);

    const analyzeData = await analyzeRes.json();
    expect(analyzeData.gaps).toBeDefined();
    expect(analyzeData.gaps.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Step 3: Verify gap report contains our seeded questions ────────

  it('gap report includes sample questions matching seeded text', async () => {
    if (!serverAvailable) return;

    const reportRes = await fetch(`${API_BASE}/gaps/report`, {
      headers: authHeaders(token),
    });
    expect(reportRes.ok).toBe(true);

    const { run, gaps } = await reportRes.json();
    expect(run).not.toBeNull();
    expect(gaps.length).toBeGreaterThanOrEqual(1);

    // At least one gap should contain sample questions resembling our seeded text
    const matchingGap = gaps.find((gap) => {
      const questions = gap.sample_questions || [];
      return questions.some(
        (q) =>
          q.toLowerCase().includes('damaged') ||
          q.toLowerCase().includes('receiving')
      );
    });

    expect(matchingGap).toBeDefined();
  });

  // ─── Step 4: Verify Briefing tab metrics (API level) ───────────────

  it('daily briefing metrics include knowledge gaps count', async () => {
    if (!serverAvailable) return;

    const briefingRes = await fetch(`${API_BASE}/briefing/metrics`, {
      headers: authHeaders(token),
    });
    expect(briefingRes.ok).toBe(true);

    const data = await briefingRes.json();
    expect(data.metrics).toBeDefined();
    expect(data.metrics.knowledgeGaps).toBeDefined();
    expect(Number(data.metrics.knowledgeGaps.open_gaps)).toBeGreaterThanOrEqual(0);
  });

  // ─── Step 5–6: Browser walkthrough (Playwright MCP) ────────────────
  //
  // The following test documents the browser-level assertions.
  // Run these manually with Playwright MCP browser tools:
  //
  // 1. browser_navigate → APP_URL
  // 2. browser_snapshot → find login form
  // 3. browser_fill_form → username/password for supervisor
  // 4. browser_click → Login button
  // 5. browser_wait_for → dashboard loads
  // 6. browser_snapshot → verify "Supervisor Dashboard" button visible
  // 7. browser_click → "Supervisor Dashboard" button
  // 8. browser_snapshot → verify Briefing tab is active
  // 9. Assert: "Knowledge Gaps" metric card is visible with value ≥ 0
  //
  // 10. browser_click → "Knowledge Gaps" tab
  // 11. browser_snapshot → verify gap analysis UI loaded
  // 12. browser_click → "Run Analysis" button (if no recent run)
  // 13. browser_wait_for → "Analysis complete" toast
  // 14. browser_snapshot → verify at least one gap card
  // 15. browser_click → expand a gap card ("Show questions")
  // 16. browser_snapshot → verify sample questions include "damaged" or "receiving"

  it('browser: briefing and knowledge gaps tabs render correctly (manual MCP walkthrough)', async () => {
    if (!serverAvailable) return;

    // This test is a placeholder confirming the API-level preconditions are met.
    // The actual browser walkthrough is performed with Playwright MCP tools
    // following the steps documented above.
    //
    // To run the browser walkthrough:
    //   1. Use Playwright MCP tools step-by-step
    //   2. Or run the full suite: npm run test:e2e -- feedback-to-gaps

    // Verify preconditions: we have gaps in the system
    const reportRes = await fetch(`${API_BASE}/gaps/report`, {
      headers: authHeaders(token),
    });
    const { gaps } = await reportRes.json();
    expect(gaps.length).toBeGreaterThanOrEqual(1);
  });
});
