require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { embedText } = require('../server/lib/embeddings');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const EXTRACTED_DIR = path.join(__dirname, '..', 'data', 'extracted');
const INDEX_PATH = path.join(__dirname, '..', 'data', 'source', 'index.json');

const ALLOWED_MODULES = ['Navigation', 'Inbound', 'Outbound', 'Picking', 'Replenishment', 'Inventory', 'CycleCounts', 'Returns', 'Admin'];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.log(`  FAIL: ${message}`);
    failed++;
  }
}

async function test11_schema() {
  console.log('\n--- Test 1.1: Schema loaded ---');
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  const tableNames = tables.rows.map(r => r.table_name);
  assert(tableNames.includes('chunks'), 'chunks table exists');
  assert(tableNames.includes('feedback'), 'feedback table exists');

  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='chunks'");
  const colNames = cols.rows.map(r => r.column_name);
  ['id', 'text', 'embedding', 'doc_title', 'module', 'slide_number', 'source_locator'].forEach(col => {
    assert(colNames.includes(col), `chunks has column: ${col}`);
  });
}

async function test12_indexJson() {
  console.log('\n--- Test 1.2: index.json valid ---');
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  assert(index.length === 16, `16 entries (got ${index.length})`);

  let allExist = true;
  let allModulesValid = true;
  for (const entry of index) {
    assert(entry.file_name && entry.doc_title && entry.module, `entry has required fields: ${entry.doc_title}`);
    const filePath = path.join(path.dirname(INDEX_PATH), entry.file_name);
    if (!fs.existsSync(filePath)) { allExist = false; }
    if (!ALLOWED_MODULES.includes(entry.module)) { allModulesValid = false; }
  }
  assert(allExist, 'all files exist on disk');
  assert(allModulesValid, 'all modules from allowed set');
}

async function test13_extraction() {
  console.log('\n--- Test 1.3: Extraction produced valid JSON ---');
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  let fileCount = 0;

  for (const entry of index) {
    const jsonPath = path.join(EXTRACTED_DIR, `${entry.doc_title.replace(/[/\\]/g, '_')}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.log(`  FAIL: Missing ${jsonPath}`);
      failed++;
      continue;
    }
    fileCount++;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert(data.doc_title && data.module && Array.isArray(data.slides), `${entry.doc_title}: has required fields`);
    assert(data.slides.length > 0, `${entry.doc_title}: ${data.slides.length} slides`);

    // Check slide structure
    let validSlides = true;
    for (const slide of data.slides) {
      if (typeof slide.number !== 'number' || typeof slide.title !== 'string' || !Array.isArray(slide.bullets)) {
        validSlides = false;
        break;
      }
    }
    assert(validSlides, `${entry.doc_title}: all slides have valid structure`);
  }
  assert(fileCount === 16, `16 JSON files found (got ${fileCount})`);
}

async function test14_ingestion() {
  console.log('\n--- Test 1.4: Chunks ingested to Postgres ---');
  const countResult = await pool.query('SELECT COUNT(*) FROM chunks');
  const count = parseInt(countResult.rows[0].count);
  assert(count > 0, `chunks table has data (${count} rows)`);

  const moduleResult = await pool.query('SELECT module, COUNT(*) as count FROM chunks GROUP BY module ORDER BY module');
  console.log('  Module counts:');
  moduleResult.rows.forEach(r => console.log(`    ${r.module}: ${r.count}`));
  const modules = moduleResult.rows.map(r => r.module);
  assert(modules.length >= 7, `at least 7 modules present (got ${modules.length})`);

  // Check ID pattern
  const sample = await pool.query('SELECT id, doc_title, slide_number FROM chunks LIMIT 5');
  let idPatternOk = true;
  for (const row of sample.rows) {
    const expected = `${row.doc_title.replace(/\s+/g, '_')}_slide_${row.slide_number}`;
    if (row.id !== expected) { idPatternOk = false; }
  }
  assert(idPatternOk, 'chunk IDs match pattern {doc_title}_slide_{N}');

  // Check no null embeddings
  const nullEmb = await pool.query('SELECT COUNT(*) FROM chunks WHERE embedding IS NULL');
  assert(parseInt(nullEmb.rows[0].count) === 0, 'zero null embeddings');
}

async function test15_vectorSearch() {
  console.log('\n--- Test 1.5: Vector search smoke test ---');
  const embedding = await embedText('How do I receive an inbound order?');
  assert(embedding.length === 1536, 'embedding has 1536 dimensions');

  const pgvector = require('pgvector/pg');
  const embSql = pgvector.toSql(embedding);

  const results = await pool.query(
    `SELECT id, doc_title, module, 1 - (embedding <=> $1) AS similarity
     FROM chunks ORDER BY embedding <=> $1 LIMIT 5`,
    [embSql]
  );
  assert(results.rows.length === 5, 'got 5 results');
  assert(results.rows[0].similarity > 0, `top result similarity: ${results.rows[0].similarity.toFixed(4)}`);

  const hasInbound = results.rows.some(r => r.module === 'Inbound' || r.doc_title.includes('Inbound'));
  assert(hasInbound, 'at least one Inbound result in top 5');

  console.log('  Top 5 results:');
  results.rows.forEach((r, i) => {
    console.log(`    ${i + 1}. [${r.module}] ${r.doc_title} (sim: ${r.similarity.toFixed(4)})`);
  });
}

async function main() {
  try {
    await test11_schema();
    await test12_indexJson();
    await test13_extraction();
    await test14_ingestion();
    await test15_vectorSearch();

    console.log(`\n========================================`);
    console.log(`Phase 1 Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);
    if (failed > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
