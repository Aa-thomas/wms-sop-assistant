import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildPrompt } = require('../../server/lib/prompt');
const { makeChunk, makeGoldenAnswer } = require('../helpers/mocks');

describe('buildPrompt with goldenExample', () => {
  const chunks = [
    makeChunk({ source_locator: 'Nav SOP - Slide 1', text: 'Login steps here' }),
  ];

  it('works without goldenExample (backwards compatible)', () => {
    const result = buildPrompt('How do I log in?', chunks);
    expect(result).toContain('How do I log in?');
    expect(result).toContain('CRITICAL RULES');
    expect(result).not.toContain('REFERENCE EXAMPLE');
  });

  it('works with goldenExample = null', () => {
    const result = buildPrompt('How do I log in?', chunks, null);
    expect(result).not.toContain('REFERENCE EXAMPLE');
  });

  it('includes golden example section when provided', () => {
    const golden = makeGoldenAnswer();
    const result = buildPrompt('How do I log in?', chunks, golden);
    expect(result).toContain('REFERENCE EXAMPLE');
    expect(result).toContain('verified good answer');
  });

  it('includes the golden question in the prompt', () => {
    const golden = makeGoldenAnswer({ question: 'How do I access the WMS portal?' });
    const result = buildPrompt('How do I log in?', chunks, golden);
    expect(result).toContain('How do I access the WMS portal?');
  });

  it('includes the golden answer as JSON', () => {
    const golden = makeGoldenAnswer();
    const result = buildPrompt('test', chunks, golden);
    expect(result).toContain('"claim"');
    expect(result).toContain('Navigate to the WMS portal');
  });

  it('golden section appears before CRITICAL RULES', () => {
    const golden = makeGoldenAnswer();
    const result = buildPrompt('test', chunks, golden);
    const refIdx = result.indexOf('REFERENCE EXAMPLE');
    const rulesIdx = result.indexOf('CRITICAL RULES');
    expect(refIdx).toBeLessThan(rulesIdx);
  });

  it('still includes grounding instruction with golden example', () => {
    const golden = makeGoldenAnswer();
    const result = buildPrompt('test', chunks, golden);
    expect(result).toContain('MUST still be grounded ONLY in the context chunks');
  });

  it('still includes context chunks when golden example is present', () => {
    const golden = makeGoldenAnswer();
    const result = buildPrompt('test', chunks, golden);
    expect(result).toContain('Login steps here');
    expect(result).toContain('Nav SOP - Slide 1');
  });
});
