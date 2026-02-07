const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generate(prompt) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
    }

    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('JSON parse failed. Raw response:', text);
      return {
        answer: [{
          claim: 'Error generating answer. Please rephrase your question.',
          citations: []
        }],
        follow_up_question: null,
        coverage: { chunks_used: 0 }
      };
    }
  } catch (error) {
    console.error('Claude API error:', error.message);
    throw new Error('Failed to generate answer');
  }
}

module.exports = { generate };
