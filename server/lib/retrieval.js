const pgvector = require('pgvector/pg');
const { embedText, embedBatch } = require('./embeddings');
const pool = require('./db');

// Register pgvector type on first connection
let registered = false;
async function getPool() {
  if (!registered) {
    const client = await pool.connect();
    await pgvector.registerType(client);
    client.release();
    registered = true;
  }
  return pool;
}

async function retrieve(question, moduleFilter = null) {
  const embedding = await embedText(question);
  const db = await getPool();
  const embSql = pgvector.toSql(embedding);

  const result = await db.query(
    `SELECT id, text, doc_title, source_locator, slide_number, module,
            1 - (embedding <=> $1) AS similarity
     FROM chunks
     WHERE $2::TEXT IS NULL OR module = $2
     ORDER BY embedding <=> $1
     LIMIT 10`,
    [embSql, moduleFilter]
  );

  return { chunks: result.rows, queryEmbedding: embedding };
}

async function multiRetrieve(queries, moduleFilter = null) {
  const embeddings = await embedBatch(queries);
  const db = await getPool();

  // Search all queries in parallel
  const results = await Promise.all(
    embeddings.map(emb => {
      const embSql = pgvector.toSql(emb);
      return db.query(
        `SELECT id, text, doc_title, source_locator, slide_number, module,
                1 - (embedding <=> $1) AS similarity
         FROM chunks
         WHERE $2::TEXT IS NULL OR module = $2
         ORDER BY embedding <=> $1
         LIMIT 8`,
        [embSql, moduleFilter]
      );
    })
  );

  // Deduplicate: keep highest similarity per chunk
  const best = new Map();
  for (const result of results) {
    for (const row of result.rows) {
      const existing = best.get(row.id);
      if (!existing || row.similarity > existing.similarity) {
        best.set(row.id, row);
      }
    }
  }

  // Sort by similarity, return top 10
  const chunks = Array.from(best.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  // Log similarity range for debugging
  if (chunks.length > 0) {
    console.log(`[RETRIEVE] Similarity range: ${chunks[0].similarity.toFixed(3)} → ${chunks[chunks.length - 1].similarity.toFixed(3)}`);
  }

  // First embedding is the original question (used for logging + golden lookup)
  return { chunks, queryEmbedding: embeddings[0] };
}

module.exports = { retrieve, multiRetrieve, getPool };
