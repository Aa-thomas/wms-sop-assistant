const express = require('express');
const { retrieve } = require('../lib/retrieval');
const { buildPrompt } = require('../lib/prompt');
const { generate } = require('../lib/generate');

const router = express.Router();

router.post('/ask', async (req, res) => {
  const { question, module } = req.body;

  // Input validation
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required' });
  }
  if (question.length > 500) {
    return res.status(400).json({ error: 'Question must be 500 characters or less' });
  }

  console.log(`[ASK] question="${question}" module=${module || 'all'}`);
  const start = Date.now();

  try {
    // 1. Retrieve relevant chunks
    const chunks = await retrieve(question, module || null);
    console.log(`[ASK] Retrieved ${chunks.length} chunks (${Date.now() - start}ms)`);

    // 2. Build prompt
    const prompt = buildPrompt(question, chunks);

    // 3. Generate answer
    const response = await generate(prompt);
    console.log(`[ASK] Generated response (${Date.now() - start}ms total)`);

    // Include retrieved chunks so frontend can show slide content on citation click
    response.sources = chunks.map(c => ({
      doc_title: c.doc_title,
      slide_number: c.slide_number,
      source_locator: c.source_locator,
      text: c.text,
      image_url: `/images/${c.doc_title.replace(/\s+/g, '_')}/slide_${c.slide_number}.png`
    }));

    res.json(response);
  } catch (error) {
    console.error('[ASK] Error:', error.message);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

router.post('/feedback', async (req, res) => {
  const { question, response_id, helpful, comment } = req.body;

  try {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      'INSERT INTO feedback (question, response_id, helpful, comment) VALUES ($1, $2, $3, $4)',
      [question, response_id, helpful, comment || null]
    );
    await pool.end();
    res.json({ success: true });
  } catch (error) {
    console.error('[FEEDBACK] Error:', error.message);
    res.status(500).json({ error: 'Failed to store feedback' });
  }
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;
