const express = require('express');
const pgvector = require('pgvector/pg');
const { multiRetrieve, getPool } = require('../lib/retrieval');
const { buildPrompt } = require('../lib/prompt');
const { generate } = require('../lib/generate');
const { findGoldenAnswer } = require('../lib/golden');
const { normalizeStepwiseAnswer } = require('../lib/answer-format');
const { expandQueries } = require('../lib/query-expand');

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
    // 1. Expand query into multiple search terms, then retrieve
    const queries = await expandQueries(question);
    console.log(`[ASK] Expanded to ${queries.length} queries (${Date.now() - start}ms)`);
    const { chunks, queryEmbedding } = await multiRetrieve(queries, module || null);
    console.log(`[ASK] Retrieved ${chunks.length} chunks (${Date.now() - start}ms)`);

    // 1b. If best similarity is too low, the question is off-topic — skip LLM
    const MIN_SIMILARITY = 0.58;
    if (chunks.length === 0 || chunks[0].similarity < MIN_SIMILARITY) {
      console.log(`[ASK] Low relevance (best: ${chunks[0]?.similarity?.toFixed(3) || 'none'}) — returning not-found`);
      return res.json({
        answer: 'Not found in SOPs',
        follow_up_question: 'Could you rephrase your question using WMS terminology?',
        suggestions: [
          'Try using specific WMS terms like "pick by order", "inbound order", or "cycle count"',
          'Use the module filter to narrow your search (Picking, Outbound, Inbound, etc.)',
          'Check the Onboarding section for guided walkthroughs of each module'
        ],
        coverage: { chunks_used: 0 },
        sources: [],
        interaction_id: null
      });
    }

    // 2. Check for golden answer
    let goldenExample = null;
    try {
      goldenExample = await findGoldenAnswer(queryEmbedding, module || null);
    } catch (err) {
      console.error('[ASK] Golden lookup failed (non-fatal):', err.message);
    }

    // 3. Build prompt
    const prompt = buildPrompt(question, chunks, goldenExample);

    // 4. Generate answer
    const rawResponse = await generate(prompt);
    const response = normalizeStepwiseAnswer(question, rawResponse);
    console.log(`[ASK] Generated response (${Date.now() - start}ms total)`);

    // 5. Log interaction (non-blocking, failure won't break response)
    let interactionId = null;
    try {
      const db = await getPool();
      const embSql = pgvector.toSql(queryEmbedding);
      const result = await db.query(
        `INSERT INTO interactions (question, module, answer, chunk_ids, similarity_scores, question_embedding, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          question,
          module || null,
          JSON.stringify(response),
          chunks.map(c => c.id),
          chunks.map(c => c.similarity),
          embSql,
          req.user ? req.user.id.toString() : null
        ]
      );
      interactionId = result.rows[0].id;
      console.log(`[ASK] Logged interaction #${interactionId}`);
    } catch (err) {
      console.error('[ASK] Failed to log interaction (non-fatal):', err.message);
    }

    // Include retrieved chunks so frontend can show slide content on citation click
    response.sources = chunks.map(c => ({
      doc_title: c.doc_title,
      slide_number: c.slide_number,
      source_locator: c.source_locator,
      text: c.text,
      image_url: `/images/${c.doc_title.replace(/\s+/g, '_')}/slide_${c.slide_number}.png`
    }));

    response.interaction_id = interactionId;

    res.json(response);
  } catch (error) {
    console.error('[ASK] Error:', error.message);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

router.post('/feedback', async (req, res) => {
  const { interaction_id, helpful, comment } = req.body;

  if (!interaction_id) {
    return res.status(400).json({ error: 'interaction_id is required' });
  }

  try {
    const db = await getPool();

    // 1. Update the interaction with feedback
    await db.query(
      'UPDATE interactions SET helpful = $1, comment = $2 WHERE id = $3',
      [helpful, comment || null, interaction_id]
    );

    // 2. If thumbs-up, auto-promote to golden answers
    if (helpful === true) {
      const interaction = await db.query(
        'SELECT question, question_embedding, answer, module FROM interactions WHERE id = $1',
        [interaction_id]
      );

      if (interaction.rows.length > 0) {
        const row = interaction.rows[0];

        // Dedup: check no existing golden answer is too similar (> 0.95)
        // Re-use the stored embedding — cast to text then to vector for pgvector operator
        const embStr = '[' + Array.from(row.question_embedding).join(',') + ']';
        const existing = await db.query(
          `SELECT id FROM golden_answers
           WHERE 1 - (question_embedding <=> $1::vector) > 0.95
           LIMIT 1`,
          [embStr]
        );

        if (existing.rows.length === 0) {
          await db.query(
            `INSERT INTO golden_answers (question, question_embedding, answer, module, interaction_id)
             VALUES ($1, $2::vector, $3, $4, $5)`,
            [row.question, embStr, row.answer, row.module, interaction_id]
          );
          console.log(`[FEEDBACK] Promoted interaction #${interaction_id} to golden answer`);
        } else {
          console.log(`[FEEDBACK] Skipped promotion — similar golden answer already exists`);
        }
      }
    }

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
