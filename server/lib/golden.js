const pgvector = require('pgvector/pg');
const { getPool } = require('./retrieval');

async function findGoldenAnswer(queryEmbedding, moduleFilter = null) {
  const db = await getPool();
  const embSql = pgvector.toSql(queryEmbedding);

  const result = await db.query(
    `SELECT question, answer, module,
            1 - (question_embedding <=> $1) AS similarity
     FROM golden_answers
     WHERE ($2::TEXT IS NULL OR module = $2)
       AND 1 - (question_embedding <=> $1) > 0.92
     ORDER BY question_embedding <=> $1
     LIMIT 1`,
    [embSql, moduleFilter]
  );

  if (result.rows.length === 0) return null;

  console.log(`[GOLDEN] Found match (similarity=${result.rows[0].similarity.toFixed(3)}): "${result.rows[0].question}"`);
  return result.rows[0];
}

module.exports = { findGoldenAnswer };
