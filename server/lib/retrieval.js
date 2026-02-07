const pgvector = require('pgvector/pg');
const { embedText } = require('./embeddings');
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

  return result.rows;
}

module.exports = { retrieve };
