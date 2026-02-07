require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedText(text, retries = 0) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (error) {
    // Quota exhausted — don't retry, fail immediately
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI quota exceeded. Add credits at https://platform.openai.com/settings/organization/billing/overview');
    }
    // Temporary rate limit — retry with backoff (max 3 retries)
    if (error.status === 429 && retries < 3) {
      const wait = Math.pow(2, retries) * 5000;
      console.log(`Rate limited, waiting ${wait / 1000}s (retry ${retries + 1}/3)...`);
      await new Promise(r => setTimeout(r, wait));
      return embedText(text, retries + 1);
    }
    console.error('Embedding failed:', error.message);
    throw new Error('Failed to embed text');
  }
}

async function embedBatch(texts, retries = 0) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });
    return response.data.map(d => d.embedding);
  } catch (error) {
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI quota exceeded. Add credits at https://platform.openai.com/settings/organization/billing/overview');
    }
    if (error.status === 429 && retries < 3) {
      const wait = Math.pow(2, retries) * 5000;
      console.log(`Rate limited, waiting ${wait / 1000}s (retry ${retries + 1}/3)...`);
      await new Promise(r => setTimeout(r, wait));
      return embedBatch(texts, retries + 1);
    }
    console.error('Batch embedding failed:', error.message);
    throw new Error('Failed to embed batch');
  }
}

module.exports = { embedText, embedBatch };
