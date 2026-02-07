import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildPrompt,
  buildOnboardingPrompt,
  buildQuizValidationPrompt,
} = require('../../server/lib/prompt');
const { makeChunk, makeStep } = require('../helpers/mocks');

describe('buildPrompt (Q&A)', () => {
  const chunks = [
    makeChunk({ source_locator: 'Nav SOP - Slide 1', text: 'Login steps here' }),
    makeChunk({ source_locator: 'Nav SOP - Slide 3', text: 'Menu bar layout', id: 'slide_3' }),
  ];

  it('returns a string', () => {
    const result = buildPrompt('How do I log in?', chunks);
    expect(typeof result).toBe('string');
  });

  it('includes the question', () => {
    const result = buildPrompt('How do I log in?', chunks);
    expect(result).toContain('How do I log in?');
  });

  it('includes all chunk source locators in context', () => {
    const result = buildPrompt('test question', chunks);
    expect(result).toContain('Nav SOP - Slide 1');
    expect(result).toContain('Nav SOP - Slide 3');
  });

  it('includes all chunk text in context', () => {
    const result = buildPrompt('test question', chunks);
    expect(result).toContain('Login steps here');
    expect(result).toContain('Menu bar layout');
  });

  it('includes grounding rules', () => {
    const result = buildPrompt('test', chunks);
    expect(result).toContain('CRITICAL RULES');
    expect(result).toContain('ONLY the provided context');
  });

  it('specifies JSON output format', () => {
    const result = buildPrompt('test', chunks);
    expect(result).toContain('"answer"');
    expect(result).toContain('"citations"');
    expect(result).toContain('"follow_up_question"');
  });

  it('works with empty chunks array', () => {
    const result = buildPrompt('test', []);
    expect(typeof result).toBe('string');
    expect(result).toContain('test');
  });
});

describe('buildOnboardingPrompt', () => {
  const step = makeStep({
    module: 'Picking',
    step_title: 'Batch Picking Workflow',
    step_description: 'Understand the batch picking process',
  });
  const chunks = [
    makeChunk({ source_locator: 'Picking SOP - Slide 5', text: 'Batch picking steps...' }),
  ];

  it('returns a string', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(typeof result).toBe('string');
  });

  it('includes the module name', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('Picking');
  });

  it('includes the step title', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('Batch Picking Workflow');
  });

  it('includes the step description', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('Understand the batch picking process');
  });

  it('includes chunk context', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('Picking SOP - Slide 5');
    expect(result).toContain('Batch picking steps...');
  });

  it('sets friendly teaching tone', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('friendly');
    expect(result).toContain('encouraging');
  });

  it('requests JSON output with explanation, quick_tip, common_mistake, citations', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('"explanation"');
    expect(result).toContain('"quick_tip"');
    expect(result).toContain('"common_mistake"');
    expect(result).toContain('"citations"');
  });

  it('includes citation structure with relevance field', () => {
    const result = buildOnboardingPrompt(step, chunks);
    expect(result).toContain('"relevance"');
    expect(result).toContain('"doc_title"');
    expect(result).toContain('"slide_number"');
  });
});

describe('buildQuizValidationPrompt', () => {
  const question = 'What are the steps to log in?';
  const userAnswer = 'Go to the portal and enter credentials';
  const chunks = [
    makeChunk({ text: 'Step 1: Navigate to portal. Step 2: Enter username and password.' }),
  ];

  it('returns a string', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(typeof result).toBe('string');
  });

  it('includes the checkpoint question', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(result).toContain('What are the steps to log in?');
  });

  it('includes the user answer', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(result).toContain('Go to the portal and enter credentials');
  });

  it('includes chunk text as reference material', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(result).toContain('Navigate to portal');
    expect(result).toContain('Enter username and password');
  });

  it('specifies grading criteria allowing paraphrased answers', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(result).toContain('paraphrased');
    expect(result).toContain('Key points');
  });

  it('requests JSON output with is_correct and feedback', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(result).toContain('"is_correct"');
    expect(result).toContain('"feedback"');
  });

  it('includes grading examples', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, chunks);
    expect(result).toContain('EXAMPLES');
    expect(result).toContain('short pick');
  });

  it('works with empty chunks', () => {
    const result = buildQuizValidationPrompt(question, userAnswer, []);
    expect(typeof result).toBe('string');
    expect(result).toContain(question);
  });
});
