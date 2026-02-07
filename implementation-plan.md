# Implementation Plan for Claude Code

## Overview
Build the WMS SOP Assistant in 4 phases. Test each phase before moving to the next.

**Total Estimated Time:** ~10 hours  
**Strategy:** Build vertically (end-to-end slice), not horizontally (all backend, then all frontend)

---

## Setup (30 min)

### Step 1: Initialize Project (This has been completed for you.Begin Step 2)
```bash
mkdir wms-sop-assistant
cd wms-sop-assistant
npm init -y
git init
```

### Step 2: Install Dependencies
```bash
# Backend
npm install express pg pgvector @anthropic-ai/sdk openai dotenv cors

# PPTX parsing
npm install pptxgenjs

# Dev dependencies
npm install --save-dev nodemon concurrently

# Frontend (in client/ subdirectory)
cd client
npm create vite@latest . -- --template react
npm install
cd ..
```

### Step 3: Create Directory Structure
```bash
mkdir -p data/{source,extracted}
mkdir -p scripts
mkdir -p server/{routes,lib}
mkdir -p client/src/components
```

### Step 4: Copy Config Files
- Copy CLAUDE.md to project root
- Copy .env.example to project root
- Copy test-questions.md to data/
- Create .env from .env.example (fill in real API keys)

### Step 5: Add Scripts to package.json
```json
{
  "scripts": {
    "extract": "node scripts/extract_pptx.js",
    "ingest": "node scripts/ingest_postgres.js",
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "server": "nodemon server/index.js",
    "client": "cd client && npm run dev"
  }
}
```

---

## Phase 1: Database + Ingestion (2.5 hours)

### Task 1.1: Database Schema (20 min)
**File:** `scripts/init_db.sql`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main chunks table
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  embedding vector(1536),
  doc_title TEXT NOT NULL,
  module TEXT NOT NULL,
  procedure TEXT,
  slide_number INT NOT NULL,
  source_locator TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (cosine distance)
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Metadata indexes for filtering
CREATE INDEX idx_module ON chunks(module);
CREATE INDEX idx_doc_title ON chunks(doc_title);

-- Feedback table
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  question TEXT,
  response_id TEXT,
  helpful BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verify
SELECT COUNT(*) FROM chunks;
```

**Test:**
```bash
# Start Postgres (if not running)
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=wms_sop \
  postgres:16

# Initialize schema
psql -d wms_sop -f scripts/init_db.sql
```

---

### Task 1.2: PPTX Extraction (1 hour)
**File:** `scripts/extract_pptx.js`

**Logic:**
1. Read all .pptx files from `data/source/`
2. For each file:
   - Extract slide number, title, bullets
   - Clean text (normalize whitespace, remove empty lines)
   - Save to `data/extracted/{filename}.json`

**Output format:**
```json
{
  "doc_title": "Outbound Order Process V3",
  "module": "Outbound",
  "slides": [
    {
      "number": 1,
      "title": "Outbound Order Processing",
      "bullets": [
        "Navigate to Orders > Outbound",
        "Select order from queue",
        "Click Process"
      ]
    }
  ]
}
```

**Test:**
```bash
# Place 1-2 sample PPTX files in data/source/
npm run extract

# Verify output
cat data/extracted/Outbound_Order_Process_V3.json | jq '.slides[0]'
```

---

### Task 1.3: Chunk Conversion + Embedding + Ingestion (1 hour)
**File:** `scripts/ingest_postgres.js`

**Logic:**
1. Read all JSON files from `data/extracted/`
2. For each slide:
   - Create chunk ID: `${docTitle}_slide_${slideNumber}`
   - Combine title + bullets into text
   - If text.length > 1500 chars → split by step numbers (rare case)
   - Embed text using OpenAI API
   - INSERT/UPDATE into Postgres
3. Batch embed requests (100 at a time to avoid rate limits)

**Code structure:**
```javascript
async function ingestFile(jsonPath) {
  const data = JSON.parse(fs.readFileSync(jsonPath));
  
  for (const slide of data.slides) {
    const chunk = {
      id: `${data.doc_title.replace(/\s+/g, '_')}_slide_${slide.number}`,
      text: `${slide.title}\n${slide.bullets.join('\n')}`,
      doc_title: data.doc_title,
      module: data.module,
      slide_number: slide.number,
      source_locator: `${data.doc_title} - Slide ${slide.number}`
    };
    
    // Embed
    const embedding = await embedText(chunk.text);
    
    // Upsert
    await db.query(`
      INSERT INTO chunks (id, text, embedding, doc_title, module, slide_number, source_locator)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE
      SET text = EXCLUDED.text,
          embedding = EXCLUDED.embedding
    `, [chunk.id, chunk.text, embedding, chunk.doc_title, chunk.module, chunk.slide_number, chunk.source_locator]);
  }
}
```

**Test:**
```bash
npm run ingest

# Verify
psql -d wms_sop -c "SELECT COUNT(*), module FROM chunks GROUP BY module;"
```

---

## Phase 2: Backend API (2 hours)

### Task 2.1: Retrieval Function (30 min)
**File:** `server/lib/retrieval.js`

**Logic:**
```javascript
async function retrieve(question, moduleFilter = null) {
  // 1. Embed question
  const embedding = await embedText(question);
  
  // 2. Query Postgres
  const query = `
    SELECT id, text, doc_title, source_locator, slide_number,
           1 - (embedding <=> $1) AS similarity
    FROM chunks
    WHERE $2::TEXT IS NULL OR module = $2
    ORDER BY embedding <=> $1
    LIMIT 10
  `;
  
  const result = await db.query(query, [embedding, moduleFilter]);
  return result.rows;
}
```

**Test:**
```javascript
// Test script
const chunks = await retrieve("How do I process a short pick?", "Outbound");
console.log(chunks.map(c => ({ 
  doc: c.doc_title, 
  slide: c.slide_number,
  similarity: c.similarity 
})));
```

---

### Task 2.2: Prompt Builder (20 min)
**File:** `server/lib/prompt.js`

**Logic:**
```javascript
function buildPrompt(question, chunks) {
  const context = chunks.map(c => 
    `[${c.source_locator}]\n${c.text}`
  ).join('\n\n---\n\n');
  
  return `You are a WMS SOP assistant.

CRITICAL RULES:
- Use ONLY the provided context
- Every claim needs a citation
- If answer not in context → "Not found in SOPs" + ask ONE clarifying question

Context:
${context}

Question: ${question}

Output JSON:
{
  "answer": [
    {
      "claim": "instruction or fact",
      "citations": [{"doc_title": "...", "source_locator": "Slide X", "slide_number": X}]
    }
  ],
  "follow_up_question": "clarifying question or null"
}`;
}
```

---

### Task 2.3: Claude Generation (30 min)
**File:** `server/lib/generate.js`

**Logic:**
```javascript
async function generate(prompt) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });
  
  try {
    return JSON.parse(response.content[0].text);
  } catch (err) {
    console.error('Parse failed:', response.content[0].text);
    return {
      answer: [{ 
        claim: "Error generating answer. Please rephrase.",
        citations: []
      }],
      follow_up_question: null
    };
  }
}
```

---

### Task 2.4: Express API (40 min)
**File:** `server/index.js` and `server/routes/ask.js`

**Endpoints:**
- `POST /ask` - Main query endpoint
- `POST /feedback` - Store feedback
- `GET /health` - Health check

**Test:**
```bash
npm run server

# Test with curl
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I process a short pick?", "module": "Outbound"}'
```

---

## Phase 3: Frontend (2.5 hours)

### Task 3.1: Search UI (1 hour)
**File:** `client/src/components/SearchBar.jsx`

**Features:**
- Text input for question
- Module dropdown (optional filter)
- Submit button
- Loading state

**File:** `client/src/components/Filters.jsx`

**Modules:**
- All (default)
- Navigation
- Inbound
- Outbound
- Picking
- Replenishment
- Inventory
- Cycle Counts
- Returns
- Admin

---

### Task 3.2: Answer Display (1 hour)
**File:** `client/src/components/Answer.jsx`

**Display:**
- Each claim as a bullet point
- Inline citations: "...navigate to Picking screen. (Outbound V3 - Slide 12)"
- Follow-up question (if present)

**File:** `client/src/components/Citations.jsx`

**Display:**
- List of unique sources used
- Format: "Outbound Order Process V3 - Slide 12"
- Future: Make these clickable links to actual SOPs

---

### Task 3.3: Feedback Buttons (30 min)
**Add to Answer.jsx:**
- 👍 Helpful button
- 👎 Not helpful button (with optional comment)
- POST to `/feedback` endpoint

**Test:**
```bash
npm run dev
# Open http://localhost:5173
# Ask a question, click feedback button
# Verify in DB: SELECT * FROM feedback;
```

---

## Phase 4: Documentation + Testing (2 hours)

### Task 4.1: README (1 hour)
**File:** `README.md`

**Sections:**
- What it does
- Quick start (Docker Compose setup)
- Manual setup
- How to add new SOPs
- Architecture diagram (ASCII art)
- Troubleshooting

---

### Task 4.2: Manual Testing (1 hour)

1. Go through `data/test-questions.md`
2. Ask each question in UI
3. Verify answers and citations
4. Document issues in test-questions.md
5. Fix critical issues

**Pass criteria:**
- 80%+ of questions get relevant answers
- All answers have citations
- Edge cases trigger safe failure
- Response time <3 seconds

---

## Verification Commands

After each phase:

```bash
# Phase 1: Database
psql -d wms_sop -c "SELECT module, COUNT(*) FROM chunks GROUP BY module;"

# Phase 2: API
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}'

# Phase 3: Frontend
open http://localhost:5173

# Phase 4: Documentation
# New developer tries to run from README
```

---

## Common Issues & Solutions

### Issue: OpenAI rate limit
**Solution:** Add exponential backoff in embeddings.js

### Issue: Postgres connection fails
**Solution:** Check DATABASE_URL in .env, verify Postgres is running

### Issue: Claude returns invalid JSON
**Solution:** Check prompt includes clear schema, log raw response

### Issue: Retrieval returns wrong docs
**Solution:** Verify embeddings are working, check similarity scores

---

## Definition of Done

✅ All 4 phases complete  
✅ Can ingest 6+ PPTX files  
✅ Can answer 15 test questions  
✅ Citations are accurate  
✅ Safe failure works  
✅ README allows new dev to run in <20 min  
✅ Feedback collection working  

Ship it! 🚀
