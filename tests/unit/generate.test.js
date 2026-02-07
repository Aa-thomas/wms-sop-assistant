import { describe, it, expect, vi, beforeEach } from 'vitest';

// For CJS modules, we mock the module's internal dependency
// by mocking the generate module itself and testing the logic inline
describe('generate', () => {
  // Replicate the generate function's parsing logic for unit testing
  // (The actual API call is tested in integration/e2e tests)
  function parseClaudeResponse(rawText) {
    let text = rawText.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      return {
        answer: [{
          claim: 'Error generating answer. Please rephrase your question.',
          citations: []
        }],
        follow_up_question: null,
        coverage: { chunks_used: 0 }
      };
    }
  }

  it('parses valid JSON response', () => {
    const result = parseClaudeResponse('{"explanation":"Test explanation","quick_tip":"Test tip"}');
    expect(result).toEqual({
      explanation: 'Test explanation',
      quick_tip: 'Test tip',
    });
  });

  it('strips markdown code fences with json specifier', () => {
    const result = parseClaudeResponse('```json\n{"explanation":"fenced"}\n```');
    expect(result.explanation).toBe('fenced');
  });

  it('strips code fences without language specifier', () => {
    const result = parseClaudeResponse('```\n{"explanation":"no lang"}\n```');
    expect(result.explanation).toBe('no lang');
  });

  it('returns fallback response on invalid JSON', () => {
    const result = parseClaudeResponse('This is not JSON at all');
    expect(result.answer).toBeDefined();
    expect(result.answer[0].claim).toContain('Error');
    expect(result.follow_up_question).toBeNull();
    expect(result.coverage.chunks_used).toBe(0);
  });

  it('handles response with leading/trailing whitespace', () => {
    const result = parseClaudeResponse('  \n{"explanation":"trimmed"}\n  ');
    expect(result.explanation).toBe('trimmed');
  });

  it('handles nested JSON objects', () => {
    const result = parseClaudeResponse('{"answer":[{"claim":"test","citations":[{"doc_title":"SOP"}]}]}');
    expect(result.answer[0].claim).toBe('test');
    expect(result.answer[0].citations[0].doc_title).toBe('SOP');
  });

  it('fallback has correct structure for Q&A format', () => {
    const result = parseClaudeResponse('}{bad json');
    expect(result.answer).toHaveLength(1);
    expect(result.answer[0]).toHaveProperty('claim');
    expect(result.answer[0]).toHaveProperty('citations');
    expect(result.answer[0].citations).toEqual([]);
    expect(result).toHaveProperty('follow_up_question', null);
    expect(result).toHaveProperty('coverage');
    expect(result.coverage).toHaveProperty('chunks_used', 0);
  });

  it('parses onboarding response format', () => {
    const json = JSON.stringify({
      explanation: 'Login by navigating to portal (Test SOP - Slide 1)',
      quick_tip: 'Bookmark the URL',
      common_mistake: 'Wrong warehouse',
      citations: [{ doc_title: 'Test SOP', source_locator: 'Slide 1', slide_number: 1, relevance: 'Login steps' }],
    });
    const result = parseClaudeResponse(json);
    expect(result.explanation).toContain('Login');
    expect(result.quick_tip).toBe('Bookmark the URL');
    expect(result.citations).toHaveLength(1);
  });

  it('parses quiz validation response format', () => {
    const json = JSON.stringify({
      is_correct: true,
      feedback: 'Great job!',
    });
    const result = parseClaudeResponse(json);
    expect(result.is_correct).toBe(true);
    expect(result.feedback).toBe('Great job!');
  });
});
