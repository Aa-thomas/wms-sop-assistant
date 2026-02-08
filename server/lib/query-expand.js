const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory cache with 30-minute TTL
const expandCache = new Map();
const EXPAND_TTL = 30 * 60 * 1000;

function getCachedExpand(key) {
  const entry = expandCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > EXPAND_TTL) {
    expandCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheExpand(key, value) {
  expandCache.set(key, { value, ts: Date.now() });
}

async function expandQueries(question) {
  const cacheKey = question.trim().toLowerCase();
  const cached = getCachedExpand(cacheKey);
  if (cached) {
    console.log(`[EXPAND-CACHE] HIT for "${question}"`);
    return cached;
  }
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `You are a search query expander for a Warehouse Management System (WMS) SOP knowledge base.

Given a user question, generate 3-5 specific search queries to find relevant SOP content. The SOPs cover:
- Navigation: WMS interface, menus, screens
- Inbound: Inbound Order Process (receiving, purchase orders, ASN)
- Outbound: Outbound Order Process (shipping, container build, shipping activities)
- Picking: Pick by Order, Pick by Cluster, Pick by Shipment, pick errors, short picks
- Replenishment: Replenishment tasks, triggers, waves
- Inventory: Store, Move, Relocation, Adjustments, Cycle Counts, Labor Management
- Returns: Customer Returns process
- Admin: System Administration, User Management, Item Loads, Warehouse Setup
- Operations: Troubleshooting, Exception Handling

RULES:
1. The first query MUST be the original question verbatim
2. Add 2-4 more queries that target specific subtopics or use WMS/SOP terminology
3. Use terms warehouse operators would see in SOPs (e.g. "pick by order" not "order-based picking")
4. Keep each query short and focused (5-12 words)

Return a JSON array of strings. No explanation, no code fences.

Question: "${question}"`
      }]
    });

    let text = response.choices[0].message.content.trim();
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
    }

    const queries = JSON.parse(text);
    if (Array.isArray(queries) && queries.length > 0) {
      console.log(`[EXPAND] "${question}" → ${queries.length} queries:`, queries);
      const result = queries.slice(0, 5);
      setCacheExpand(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error('[EXPAND] Failed, falling back to original question:', err.message);
  }

  return [question];
}

module.exports = { expandQueries };
