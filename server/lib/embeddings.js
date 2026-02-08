require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory cache with 30-minute TTL
const embedCache = new Map();
const EMBED_TTL = 30 * 60 * 1000;

function getCachedEmbed(key) {
  const entry = embedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > EMBED_TTL) {
    embedCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheEmbed(key, value) {
  embedCache.set(key, { value, ts: Date.now() });
}

async function embedText(text, retries = 0) {
  const cached = getCachedEmbed(text);
  if (cached) {
    console.log(`[EMBED-CACHE] HIT for "${text.slice(0, 50)}..."`);
    return cached;
  }
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    const embedding = response.data[0].embedding;
    setCacheEmbed(text, embedding);
    return embedding;
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
  // Check cache for each text, only embed uncached ones
  const results = new Array(texts.length);
  const uncachedIndices = [];
  const uncachedTexts = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = getCachedEmbed(texts[i]);
    if (cached) {
      results[i] = cached;
    } else {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  if (uncachedIndices.length > 0 && results.some(r => r)) {
    console.log(`[EMBED-CACHE] ${texts.length - uncachedIndices.length}/${texts.length} from cache`);
  }

  if (uncachedIndices.length === 0) {
    console.log(`[EMBED-CACHE] HIT all ${texts.length} texts from cache`);
    return results;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: uncachedTexts
    });
    const embeddings = response.data.map(d => d.embedding);
    for (let i = 0; i < uncachedIndices.length; i++) {
      results[uncachedIndices[i]] = embeddings[i];
      setCacheEmbed(uncachedTexts[i], embeddings[i]);
    }
    return results;
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
