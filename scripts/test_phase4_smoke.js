#!/usr/bin/env node

const BASE = 'http://localhost:3000';

const questions = [
  {
    label: 'Q1 — Inbound order (should cite Inbound SOP)',
    body: { question: 'How do I receive an inbound order?' },
    validate(res) {
      const errors = [];
      if (!Array.isArray(res.answer)) errors.push('answer is not an array');
      else {
        if (res.answer.length === 0) errors.push('answer array is empty');
        const hasCitation = res.answer.some(a => a.citations && a.citations.length > 0);
        if (!hasCitation) errors.push('no citations found in any claim');
        const mentionsInbound = res.answer.some(a =>
          a.citations?.some(c =>
            /inbound/i.test(c.doc_title) || /inbound/i.test(c.source_locator)
          )
        );
        if (!mentionsInbound) errors.push('no citation references Inbound SOP');
      }
      return errors;
    }
  },
  {
    label: 'Q2 — Short pick (should cite Picking or Outbound SOP)',
    body: { question: 'How do I process a short pick?' },
    validate(res) {
      const errors = [];
      if (!Array.isArray(res.answer)) errors.push('answer is not an array');
      else {
        if (res.answer.length === 0) errors.push('answer array is empty');
        const hasCitation = res.answer.some(a => a.citations && a.citations.length > 0);
        if (!hasCitation) errors.push('no citations found in any claim');
      }
      return errors;
    }
  },
  {
    label: 'Q3 — Out of scope (should trigger safe failure)',
    body: { question: 'What is the weather today?' },
    validate(res) {
      const errors = [];
      const isStringNotFound = typeof res.answer === 'string' && /not found/i.test(res.answer);
      const isArrayNotFound = Array.isArray(res.answer) && res.answer.some(a =>
        /not found|no information|not covered|cannot find|don't have/i.test(a.claim)
      );
      if (!isStringNotFound && !isArrayNotFound) {
        errors.push('expected "not found" safe failure but got a grounded answer');
      }
      if (!res.follow_up_question) {
        // Not strictly required but expected per PRD
        console.log('    ⚠  No follow-up question returned (optional but expected)');
      }
      return errors;
    }
  }
];

async function run() {
  console.log('=== Phase 4 Smoke Test — 3 End-to-End Questions ===\n');

  let passed = 0;
  let failed = 0;

  for (const q of questions) {
    console.log(`▸ ${q.label}`);
    const start = Date.now();

    try {
      const resp = await fetch(`${BASE}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q.body)
      });

      const elapsed = ((Date.now() - start) / 1000).toFixed(2);

      if (resp.status !== 200) {
        console.log(`  ✗ FAIL — HTTP ${resp.status} (${elapsed}s)\n`);
        failed++;
        continue;
      }

      const data = await resp.json();

      // Time check
      if (elapsed > 5) {
        console.log(`  ⚠  Response took ${elapsed}s (target <5s)`);
      } else {
        console.log(`  ⏱  ${elapsed}s`);
      }

      // Validate
      const errors = q.validate(data);
      if (errors.length === 0) {
        console.log('  ✓ PASS');
        passed++;
      } else {
        console.log('  ✗ FAIL');
        errors.forEach(e => console.log(`    - ${e}`));
        failed++;
      }

      // Print summary of response
      if (Array.isArray(data.answer)) {
        console.log(`  → ${data.answer.length} claim(s)`);
        data.answer.forEach((a, i) => {
          const cites = (a.citations || []).map(c => c.source_locator).join(', ');
          const claimPreview = a.claim.length > 100 ? a.claim.slice(0, 100) + '…' : a.claim;
          console.log(`    [${i + 1}] "${claimPreview}"`);
          if (cites) console.log(`        Citations: ${cites}`);
        });
      } else {
        console.log(`  → Answer (string): "${data.answer}"`);
      }
      if (data.follow_up_question) {
        console.log(`  → Follow-up: "${data.follow_up_question}"`);
      }
    } catch (err) {
      console.log(`  ✗ FAIL — ${err.message}`);
      failed++;
    }
    console.log();
  }

  console.log('=== Summary ===');
  console.log(`Passed: ${passed}/${questions.length}`);
  console.log(`Failed: ${failed}/${questions.length}`);

  if (failed > 0) {
    console.log('\n❌ Smoke test FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests PASSED');
  }
}

run();
