const pgvector = require('pgvector/pg');
const { getPool } = require('./retrieval');
const { embedText } = require('./embeddings');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function centroid(embeddings) {
  const dim = embeddings[0].length;
  const avg = new Array(dim).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] += emb[i];
  }
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length;
  return avg;
}

/**
 * Find gap interactions from the last N days.
 * Gap signals: "Not found" responses, low similarity, negative feedback.
 */
async function findGapInteractions(db, periodStart, periodEnd) {
  const result = await db.query(
    `SELECT id, question, question_embedding, answer, module,
            similarity_scores, helpful
     FROM interactions
     WHERE created_at >= $1 AND created_at <= $2
       AND (
         helpful = false
         OR answer::text ILIKE '%not found in sops%'
         OR (similarity_scores IS NOT NULL AND similarity_scores[1] < 0.35)
         OR (helpful IS NULL AND similarity_scores IS NOT NULL AND similarity_scores[1] < 0.35)
       )
     ORDER BY created_at DESC`,
    [periodStart, periodEnd]
  );
  return result.rows;
}

/**
 * Cluster similar gap questions using in-memory cosine similarity.
 */
function clusterQuestions(interactions) {
  const clusters = []; // { questions: string[], embeddings: number[][], centroid: number[], ids: number[], modules: string[] }

  for (const interaction of interactions) {
    if (!interaction.question_embedding) continue;

    // Parse embedding from pgvector format
    let embedding;
    if (typeof interaction.question_embedding === 'string') {
      embedding = JSON.parse(interaction.question_embedding.replace(/^\[/, '[').replace(/\]$/, ']'));
    } else if (Array.isArray(interaction.question_embedding)) {
      embedding = interaction.question_embedding;
    } else {
      continue;
    }

    let bestCluster = null;
    let bestSim = 0;

    for (const cluster of clusters) {
      const sim = cosineSimilarity(embedding, cluster.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestSim > 0.80) {
      bestCluster.questions.push(interaction.question);
      bestCluster.embeddings.push(embedding);
      bestCluster.ids.push(interaction.id);
      if (interaction.module) bestCluster.modules.push(interaction.module);
      bestCluster.centroid = centroid(bestCluster.embeddings);
    } else {
      clusters.push({
        questions: [interaction.question],
        embeddings: [embedding],
        centroid: embedding,
        ids: [interaction.id],
        modules: interaction.module ? [interaction.module] : []
      });
    }
  }

  return clusters.filter(c => c.questions.length >= 2);
}

/**
 * Use Claude to generate a title and description for a question cluster.
 */
async function generateClusterTitle(questions) {
  const questionList = questions.slice(0, 10).map((q, i) => `${i + 1}. ${q}`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `These are user questions that our WMS SOP system could not answer well. Generate a short title (under 80 chars) and a 1-2 sentence description summarizing the knowledge gap they represent.

Questions:
${questionList}

Respond in JSON: {"title": "...", "description": "..."}`
    }]
  });

  let text = response.content[0].text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  try {
    return JSON.parse(text);
  } catch {
    return { title: questions[0].substring(0, 80), description: 'Cluster of similar unanswered questions.' };
  }
}

/**
 * Determine severity based on question count and feedback signals.
 */
function determineSeverity(cluster, interactions) {
  const hasNegativeFeedback = cluster.ids.some(id => {
    const interaction = interactions.find(i => i.id === id);
    return interaction && interaction.helpful === false;
  });

  if (cluster.questions.length >= 5 || hasNegativeFeedback) return 'high';
  if (cluster.questions.length >= 3) return 'medium';
  return 'low';
}

/**
 * Infer the most likely module from cluster questions.
 */
function inferModule(cluster) {
  const moduleCounts = {};
  for (const m of cluster.modules) {
    moduleCounts[m] = (moduleCounts[m] || 0) + 1;
  }
  const sorted = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

/**
 * Main gap analysis function. Analyzes interactions from the last N days.
 */
async function analyzeGaps(periodDays = 7) {
  const db = await getPool();
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Create run record
  const runResult = await db.query(
    `INSERT INTO gap_analysis_runs (period_start, period_end, status)
     VALUES ($1, $2, 'running') RETURNING id`,
    [periodStart, periodEnd]
  );
  const runId = runResult.rows[0].id;

  try {
    // Find gap interactions
    const interactions = await findGapInteractions(db, periodStart, periodEnd);
    console.log(`[GAP] Found ${interactions.length} gap interactions in last ${periodDays} days`);

    if (interactions.length === 0) {
      await db.query(
        `UPDATE gap_analysis_runs SET completed_at = NOW(), total_interactions = 0, gaps_found = 0, status = 'completed' WHERE id = $1`,
        [runId]
      );
      return { runId, gaps: [], totalInteractions: 0 };
    }

    // Cluster questions
    const clusters = clusterQuestions(interactions);
    console.log(`[GAP] Formed ${clusters.length} clusters (>= 2 questions each)`);

    // Generate titles and insert gaps
    const gaps = [];
    for (const cluster of clusters) {
      const { title, description } = await generateClusterTitle(cluster.questions);
      const severity = determineSeverity(cluster, interactions);
      const suggestedModule = inferModule(cluster);
      const sampleQuestions = cluster.questions.slice(0, 5);

      const gapResult = await db.query(
        `INSERT INTO knowledge_gaps (run_id, title, description, sample_questions, question_count, suggested_module, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [runId, title, description, sampleQuestions, cluster.questions.length, suggestedModule, severity]
      );

      gaps.push({
        id: gapResult.rows[0].id,
        title,
        description,
        sample_questions: sampleQuestions,
        question_count: cluster.questions.length,
        suggested_module: suggestedModule,
        severity,
        status: 'open'
      });
    }

    // Update run record
    await db.query(
      `UPDATE gap_analysis_runs SET completed_at = NOW(), total_interactions = $1, gaps_found = $2, status = 'completed' WHERE id = $3`,
      [interactions.length, gaps.length, runId]
    );

    console.log(`[GAP] Analysis complete: ${gaps.length} gaps from ${interactions.length} interactions`);
    return { runId, gaps, totalInteractions: interactions.length };

  } catch (error) {
    await db.query(
      `UPDATE gap_analysis_runs SET completed_at = NOW(), status = 'failed' WHERE id = $1`,
      [runId]
    );
    throw error;
  }
}

/**
 * Generate an SOP draft for a specific knowledge gap.
 */
async function generateSopDraft(gapId) {
  const db = await getPool();

  // Load gap record
  const gapResult = await db.query(
    'SELECT id, title, description, sample_questions, suggested_module FROM knowledge_gaps WHERE id = $1',
    [gapId]
  );
  if (gapResult.rows.length === 0) throw new Error('Gap not found');
  const gap = gapResult.rows[0];

  // Retrieve partially-relevant chunks for style context
  const embedding = await embedText(gap.title + ' ' + gap.sample_questions[0]);
  const embSql = pgvector.toSql(embedding);
  const contextResult = await db.query(
    `SELECT text, doc_title, source_locator FROM chunks
     ORDER BY embedding <=> $1 LIMIT 5`,
    [embSql]
  );
  const styleContext = contextResult.rows.map(c =>
    `--- ${c.source_locator} ---\n${c.text}`
  ).join('\n\n');

  const questionList = gap.sample_questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are a WMS (Warehouse Management System) SOP writer. Users asked these questions but our SOPs had no good answers:

Topic: ${gap.title}
Description: ${gap.description}
${gap.suggested_module ? `Module: ${gap.suggested_module}` : ''}

User questions:
${questionList}

Here are some existing SOPs for reference on style and format:
${styleContext}

Write a structured SOP draft that would answer these questions. Use this format:

# [SOP Title]
## Module: [module name]

### Prerequisites
- [list any prerequisites]

### Procedure
1. [Numbered steps with clear instructions]
2. [Each step should be actionable]

### Troubleshooting
- **Issue:** [common issue] → **Solution:** [resolution]

### Notes
- [Any important notes or warnings]

Write the SOP in plain text, matching the style of existing SOPs.`
    }]
  });

  const draft = response.content[0].text.trim();

  await db.query(
    'UPDATE knowledge_gaps SET sop_draft = $1, sop_draft_generated_at = NOW() WHERE id = $2',
    [draft, gapId]
  );

  return draft;
}

module.exports = { analyzeGaps, generateSopDraft };
