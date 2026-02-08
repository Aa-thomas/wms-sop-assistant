require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pgvector = require('pgvector/pg');
const { embedBatch } = require('../server/lib/embeddings');

const EXTRACTED_DIR = path.join(__dirname, '..', 'data', 'extracted');
const BATCH_SIZE = 100;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ingestFile(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  if (!data.slides || !Array.isArray(data.slides)) {
    console.log(`Skipping: ${path.basename(jsonPath)} (not a slide document)`);
    return 0;
  }
  console.log(`Ingesting: ${data.doc_title} (${data.slides.length} slides)`);

  // Build chunks from slides
  const chunks = data.slides.map(slide => {
    const text = [slide.title, ...slide.bullets].filter(Boolean).join('\n');
    return {
      id: `${data.doc_title.replace(/\s+/g, '_')}_slide_${slide.number}`,
      text,
      doc_title: data.doc_title,
      module: data.module,
      slide_number: slide.number,
      source_locator: `${data.doc_title} - Slide ${slide.number}`
    };
  }).filter(c => c.text.trim().length > 0);

  // Embed in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    console.log(`  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} (${batch.length} chunks)`);
    const embeddings = await embedBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = pgvector.toSql(embeddings[j]);

      await pool.query(`
        INSERT INTO chunks (id, text, embedding, doc_title, module, slide_number, source_locator)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE
        SET text = EXCLUDED.text,
            embedding = EXCLUDED.embedding
      `, [chunk.id, chunk.text, embedding, chunk.doc_title, chunk.module, chunk.slide_number, chunk.source_locator]);
    }
  }

  return chunks.length;
}

async function main() {
  // Register pgvector type (requires a client, not a pool)
  const client = await pool.connect();
  await pgvector.registerType(client);
  client.release();

  const files = fs.readdirSync(EXTRACTED_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} extracted files to ingest.\n`);

  let totalChunks = 0;

  for (const file of files) {
    const count = await ingestFile(path.join(EXTRACTED_DIR, file));
    totalChunks += count;
  }

  // Create vector index after all data is loaded
  console.log('\nCreating vector similarity index...');
  const { rows } = await pool.query('SELECT COUNT(*) FROM chunks');
  const chunkCount = parseInt(rows[0].count);
  // IVFFlat lists should be sqrt(n) roughly, min 1
  const lists = Math.max(1, Math.round(Math.sqrt(chunkCount)));
  await pool.query(`DROP INDEX IF EXISTS chunks_embedding_idx`);
  await pool.query(`CREATE INDEX chunks_embedding_idx ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = ${lists})`);

  console.log(`\nDone. Ingested ${totalChunks} chunks. Index created with lists=${lists}.`);

  // Summary
  const result = await pool.query('SELECT module, COUNT(*) as count FROM chunks GROUP BY module ORDER BY module');
  console.log('\nChunks per module:');
  result.rows.forEach(r => console.log(`  ${r.module}: ${r.count}`));

  await pool.end();
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
