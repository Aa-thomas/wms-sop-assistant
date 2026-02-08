const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generate(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.choices[0].message.content.trim();

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
    console.error('OpenAI API error:', error.message);
    throw new Error('Failed to generate answer');
  }
}

module.exports = { generate };
