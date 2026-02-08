const pgvector = require('pgvector/pg');
const { getPool } = require('./retrieval');
const { embedText } = require('./embeddings');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
            similarity_scores, helpful, 'interaction' as source_type
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
 * Find relevant anonymous feedback that may indicate knowledge gaps.
 * Focuses on training, workflow, and process-related feedback.
 */
async function findGapFeedback(db, periodStart, periodEnd) {
  const result = await db.query(
    `SELECT id, type, category, message, urgency, message_embedding,
            'feedback' as source_type
     FROM anonymous_feedback
     WHERE created_at >= $1 AND created_at <= $2
       AND status != 'dismissed'
       AND (
         category IN ('training', 'workflow', 'equipment')
         OR type = 'suggestion'
         OR (type = 'complaint' AND urgency IN ('normal', 'high'))
       )
     ORDER BY created_at DESC`,
    [periodStart, periodEnd]
  );
  return result.rows;
}

/**
 * Ensure feedback messages have embeddings for clustering.
 */
async function embedFeedbackMessages(db, feedbackItems) {
  const needsEmbedding = feedbackItems.filter(f => !f.message_embedding);
  
  for (const feedback of needsEmbedding) {
    try {
      const embedding = await embedText(feedback.message);
      const embSql = pgvector.toSql(embedding);
      await db.query(
        'UPDATE anonymous_feedback SET message_embedding = $1 WHERE id = $2',
        [embSql, feedback.id]
      );
      feedback.message_embedding = embedding;
    } catch (err) {
      console.error(`[GAP] Failed to embed feedback #${feedback.id}:`, err.message);
    }
  }
  
  return feedbackItems;
}

/**
 * Cluster similar gap signals (questions + feedback) using in-memory cosine similarity.
 */
function clusterGapSignals(interactions, feedbackItems) {
  const clusters = []; 
  // { questions: string[], feedback: string[], embeddings: number[][], centroid: number[], 
  //   interactionIds: number[], feedbackIds: number[], modules: string[], categories: string[] }

  // Process interactions
  for (const interaction of interactions) {
    if (!interaction.question_embedding) continue;

    const embedding = parseEmbedding(interaction.question_embedding);
    if (!embedding) continue;

    const { cluster, similarity } = findBestCluster(clusters, embedding);

    if (cluster && similarity > 0.80) {
      cluster.questions.push(interaction.question);
      cluster.embeddings.push(embedding);
      cluster.interactionIds.push(interaction.id);
      if (interaction.module) cluster.modules.push(interaction.module);
      cluster.centroid = centroid(cluster.embeddings);
    } else {
      clusters.push({
        questions: [interaction.question],
        feedback: [],
        embeddings: [embedding],
        centroid: embedding,
        interactionIds: [interaction.id],
        feedbackIds: [],
        modules: interaction.module ? [interaction.module] : [],
        categories: []
      });
    }
  }

  // Process feedback - can join existing clusters or form new ones
  for (const fb of feedbackItems) {
    if (!fb.message_embedding) continue;

    const embedding = parseEmbedding(fb.message_embedding);
    if (!embedding) continue;

    const { cluster, similarity } = findBestCluster(clusters, embedding);

    if (cluster && similarity > 0.75) {
      // Lower threshold for feedback since it's less precise than questions
      cluster.feedback.push({ message: fb.message, type: fb.type, category: fb.category, urgency: fb.urgency });
      cluster.embeddings.push(embedding);
      cluster.feedbackIds.push(fb.id);
      if (fb.category) cluster.categories.push(fb.category);
      cluster.centroid = centroid(cluster.embeddings);
    } else {
      // Create feedback-only cluster
      clusters.push({
        questions: [],
        feedback: [{ message: fb.message, type: fb.type, category: fb.category, urgency: fb.urgency }],
        embeddings: [embedding],
        centroid: embedding,
        interactionIds: [],
        feedbackIds: [fb.id],
        modules: [],
        categories: fb.category ? [fb.category] : []
      });
    }
  }

  // Filter: need at least 2 signals (questions + feedback combined)
  return clusters.filter(c => (c.questions.length + c.feedback.length) >= 2);
}

/**
 * Parse embedding from various formats.
 */
function parseEmbedding(emb) {
  if (!emb) return null;
  if (typeof emb === 'string') {
    try {
      return JSON.parse(emb.replace(/^\[/, '[').replace(/\]$/, ']'));
    } catch {
      return null;
    }
  }
  if (Array.isArray(emb)) return emb;
  return null;
}

/**
 * Find the best matching cluster for an embedding.
 */
function findBestCluster(clusters, embedding) {
  let bestCluster = null;
  let bestSim = 0;

  for (const cluster of clusters) {
    const sim = cosineSimilarity(embedding, cluster.centroid);
    if (sim > bestSim) {
      bestSim = sim;
      bestCluster = cluster;
    }
  }

  return { cluster: bestCluster, similarity: bestSim };
}

/**
 * Use AI to generate a title and description for a gap cluster.
 */
async function generateClusterTitle(cluster) {
  const questionList = cluster.questions.slice(0, 8).map((q, i) => `${i + 1}. ${q}`).join('\n');
  const feedbackList = cluster.feedback.slice(0, 5).map((f, i) => 
    `${i + 1}. [${f.type.toUpperCase()}${f.urgency === 'high' ? ' - HIGH PRIORITY' : ''}] ${f.message}`
  ).join('\n');

  let prompt = `Analyze these signals from a WMS (Warehouse Management System) to identify a knowledge gap. Generate a short title (under 80 chars) and a 1-2 sentence description.\n\n`;
  
  if (cluster.questions.length > 0) {
    prompt += `User questions that couldn't be answered:\n${questionList}\n\n`;
  }
  
  if (cluster.feedback.length > 0) {
    prompt += `Anonymous employee feedback:\n${feedbackList}\n\n`;
  }

  prompt += `Respond in JSON: {"title": "...", "description": "..."}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  let text = response.choices[0].message.content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '');
  }

  try {
    return JSON.parse(text);
  } catch {
    const fallback = cluster.questions[0] || cluster.feedback[0]?.message || 'Unknown gap';
    return { title: fallback.substring(0, 80), description: 'Cluster of related questions and feedback.' };
  }
}

/**
 * Determine severity based on question count, feedback signals, and urgency.
 */
function determineSeverity(cluster, interactions) {
  const totalSignals = cluster.questions.length + cluster.feedback.length;
  
  // Check for negative interaction feedback
  const hasNegativeFeedback = cluster.interactionIds.some(id => {
    const interaction = interactions.find(i => i.id === id);
    return interaction && interaction.helpful === false;
  });

  // Check for high urgency anonymous feedback
  const hasHighUrgency = cluster.feedback.some(f => f.urgency === 'high');
  
  // Check for complaints
  const hasComplaints = cluster.feedback.some(f => f.type === 'complaint');

  if (totalSignals >= 5 || hasHighUrgency || (hasComplaints && totalSignals >= 3)) return 'high';
  if (totalSignals >= 3 || hasNegativeFeedback || hasComplaints) return 'medium';
  return 'low';
}

/**
 * Infer the most likely module from cluster data.
 */
function inferModule(cluster) {
  const moduleCounts = {};
  
  // Count from interaction modules
  for (const m of cluster.modules) {
    moduleCounts[m] = (moduleCounts[m] || 0) + 1;
  }
  
  // Map feedback categories to likely modules
  const categoryToModule = {
    'training': 'Training',
    'workflow': 'Operations',
    'equipment': 'Equipment',
    'safety': 'Safety'
  };
  
  for (const cat of cluster.categories) {
    const module = categoryToModule[cat];
    if (module) {
      moduleCounts[module] = (moduleCounts[module] || 0) + 0.5; // Weight feedback lower
    }
  }
  
  const sorted = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : null;
}

/**
 * Main gap analysis function. Analyzes interactions + feedback from the last N days.
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

    // Find relevant feedback
    let feedbackItems = await findGapFeedback(db, periodStart, periodEnd);
    console.log(`[GAP] Found ${feedbackItems.length} relevant feedback items`);

    // Ensure feedback has embeddings
    feedbackItems = await embedFeedbackMessages(db, feedbackItems);

    const totalSignals = interactions.length + feedbackItems.length;
    if (totalSignals === 0) {
      await db.query(
        `UPDATE gap_analysis_runs SET completed_at = NOW(), total_interactions = 0, gaps_found = 0, status = 'completed' WHERE id = $1`,
        [runId]
      );
      return { runId, gaps: [], totalInteractions: 0, totalFeedback: 0 };
    }

    // Cluster questions and feedback together
    const clusters = clusterGapSignals(interactions, feedbackItems);
    console.log(`[GAP] Formed ${clusters.length} clusters (>= 2 signals each)`);

    // Generate titles and insert gaps
    const gaps = [];
    for (const cluster of clusters) {
      const { title, description } = await generateClusterTitle(cluster);
      const severity = determineSeverity(cluster, interactions);
      const suggestedModule = inferModule(cluster);
      const sampleQuestions = cluster.questions.slice(0, 5);
      const sampleFeedback = cluster.feedback.slice(0, 3).map(f => f.message);
      const signalCount = cluster.questions.length + cluster.feedback.length;

      const gapResult = await db.query(
        `INSERT INTO knowledge_gaps (run_id, title, description, sample_questions, question_count, suggested_module, severity)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [runId, title, description, [...sampleQuestions, ...sampleFeedback], signalCount, suggestedModule, severity]
      );

      // Mark feedback as processed
      if (cluster.feedbackIds.length > 0) {
        await db.query(
          `UPDATE anonymous_feedback SET gap_processed = true WHERE id = ANY($1)`,
          [cluster.feedbackIds]
        );
      }

      gaps.push({
        id: gapResult.rows[0].id,
        title,
        description,
        sample_questions: sampleQuestions,
        sample_feedback: sampleFeedback,
        question_count: cluster.questions.length,
        feedback_count: cluster.feedback.length,
        suggested_module: suggestedModule,
        severity,
        status: 'open'
      });
    }

    // Update run record
    await db.query(
      `UPDATE gap_analysis_runs SET completed_at = NOW(), total_interactions = $1, gaps_found = $2, status = 'completed' WHERE id = $3`,
      [totalSignals, gaps.length, runId]
    );

    console.log(`[GAP] Analysis complete: ${gaps.length} gaps from ${interactions.length} interactions + ${feedbackItems.length} feedback`);
    return { runId, gaps, totalInteractions: interactions.length, totalFeedback: feedbackItems.length };

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

  // Separate questions from feedback in sample_questions (feedback entries often start with category-like text)
  const allSamples = gap.sample_questions || [];
  const questionList = allSamples.map((q, i) => `${i + 1}. ${q}`).join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `You are a WMS (Warehouse Management System) SOP writer. Users asked these questions or submitted feedback indicating gaps in our documentation:

Topic: ${gap.title}
Description: ${gap.description}
${gap.suggested_module ? `Module: ${gap.suggested_module}` : ''}

User questions and feedback:
${questionList}

Here are some existing SOPs for reference on style and format:
${styleContext}

Write a structured SOP draft that would address these gaps. Use this format:

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

  const draft = response.choices[0].message.content.trim();

  await db.query(
    'UPDATE knowledge_gaps SET sop_draft = $1, sop_draft_generated_at = NOW() WHERE id = $2',
    [draft, gapId]
  );

  return draft;
}

module.exports = { analyzeGaps, generateSopDraft };
