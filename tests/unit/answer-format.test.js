import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  looksProceduralQuestion,
  splitSingleClaimIntoSteps,
  normalizeStepwiseAnswer
} = require('../../server/lib/answer-format');

describe('answer-format normalization', () => {
  it('detects procedural questions', () => {
    expect(looksProceduralQuestion('How do I process an inbound order?')).toBe(true);
    expect(looksProceduralQuestion('What is WMS?')).toBe(false);
  });

  it('splits long procedural claim into multiple steps', () => {
    const parts = splitSingleClaimIntoSteps(
      'Open the receiving menu. Enter the receipt number. Confirm quantity and click continue.'
    );
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('normalizes single-claim procedural answers to multiple claims', () => {
    const response = {
      answer: [
        {
          claim: 'Open the receiving menu. Enter the receipt number. Confirm quantity and click continue.',
          citations: [{ doc_title: 'Inbound', source_locator: 'Slide 7', slide_number: 7 }]
        }
      ],
      follow_up_question: null
    };

    const normalized = normalizeStepwiseAnswer('What are the steps for receiving?', response);
    expect(normalized.answer.length).toBeGreaterThanOrEqual(2);
    expect(normalized.answer[0].citations[0].slide_number).toBe(7);
  });

  it('does not split non-procedural responses', () => {
    const response = {
      answer: [{ claim: 'Warehouse Management is the core menu.', citations: [] }]
    };
    const normalized = normalizeStepwiseAnswer('What is warehouse management?', response);
    expect(normalized.answer).toHaveLength(1);
  });
});
