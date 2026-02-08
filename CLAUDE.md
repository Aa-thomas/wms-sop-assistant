# WMS SOP Assistant - Claude Code Instructions

## Project Context
This is a RAG-based chatbot for warehouse operators to search WMS (Warehouse Management System) SOPs. It MUST only answer from indexed content, never hallucinate, and always cite sources.

## Critical Constraints

### Grounding Rules (NEVER VIOLATE)
- Answers ONLY from retrieved SOP chunks
- Every claim needs a citation (doc_title + slide_number)
- If answer not in context → return "Not found in SOPs" + clarifying question
- No external knowledge, no "best practices" unless SOP explicitly states it

### Architecture Decisions (Already Made)
- **Database:** PostgreSQL 16 with pgvector extension (NOT SQLite, NOT Pinecone)
- **Embeddings:** OpenAI text-embedding-3-small (1536 dimensions)
- **LLM:** Claude Sonnet 4.5 for generation
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Chunking Strategy:** One slide = one chunk (no semantic chunking)

### Code Style & Patterns

#### When Writing SQL
```sql
-- Good: Use parameterized queries
const results = await db.query(
  'SELECT * FROM chunks WHERE module = $1',
  [moduleFilter]
);

-- Bad: String interpolation (SQL injection risk)
const results = await db.query(
  `SELECT * FROM chunks WHERE module = '${moduleFilter}'`
);
```

#### When Calling External APIs
```javascript
// Always use try-catch with specific error handling
try {
  const embedding = await openai.embeddings.create({...});
  return embedding.data[0].embedding;
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // Retry with exponential backoff
  }
  console.error('Embedding failed:', error);
  throw new Error('Failed to embed query');
}
```

#### When Parsing JSON from Claude
```javascript
// Good: Simple try-catch, safe fallback
try {
  return JSON.parse(response.content[0].text);
} catch (err) {
  console.error('Parse failed:', response.content[0].text);
  return { 
    answer: [{ claim: "Error. Please rephrase.", citations: [] }],
    follow_up_question: null
  };
}

// Bad: Complex validation libraries (zod/ajv), retry logic
// We don't need this - Claude Sonnet is reliable with JSON
```

### Data Model Constraints

#### Chunk ID Format
```javascript
// Always use this pattern for stable IDs
const chunkId = `${docTitle.replace(/\s+/g, '_')}_slide_${slideNumber}`;

// Example: "Outbound_Order_Process_V3_slide_12"
```

#### Required Metadata Fields
Every chunk MUST have:
- `id` (stable, deterministic)
- `text` (slide title + bullets)
- `embedding` (vector[1536])
- `doc_title` (original PPTX filename without extension)
- `module` (one of: Navigation, Inbound, Outbound, Picking, Waves, Replenishment, Inventory, CycleCounts, Operations, Returns, Admin)
- `slide_number` (integer)
- `source_locator` (human-readable: "{doc_title} - Slide {number}")

Optional fields:
- `procedure` (extracted if available)
- `tags` (keywords from text)

### Performance Requirements
- Vector search: <100ms for 2,500 chunks
- Total API response time: <3 seconds (including Claude generation)
- Ingestion: Handle 10 PPTX files (~500 slides) in <5 minutes

### Testing Strategy
- **NO automated test frameworks** for MVP
- Manual testing with `data/test-questions.md`
- Log all requests to console for debugging
- Add basic error handling, but don't over-engineer

### Common Mistakes to Avoid

#### ❌ Don't Do This
```javascript
// Semantic chunking (too complex for MVP)
if (hasHeadingChange || hasStepLabel) {
  startNewChunk();
}

// Re-scoring with magic numbers
const score = similarity * 0.7 + moduleBoost * 0.2 + termMatch * 0.1;

// Token counting and truncation
if (totalTokens > MAX_TOKENS) {
  truncateContext();
}
```

#### ✅ Do This Instead
```javascript
// One slide = one chunk (simple)
const chunks = slides.map(slide => ({
  id: `${docTitle}_slide_${slide.number}`,
  text: `${slide.title}\n${slide.bullets.join('\n')}`
}));

// Plain similarity search (no re-scoring)
ORDER BY embedding <=> $1 LIMIT 10

// No token limits (chunks are small, we won't hit limits)
const context = chunks.map(c => c.text).join('\n\n');
```

### File Organization

```
scripts/
├── extract_pptx.js      # PPTX → JSON (use PptxGenJS or officegen)
├── ingest_postgres.js   # Embed + INSERT to Postgres
└── init_db.sql          # Schema + indexes

server/
├── index.js             # Express app
├── routes/ask.js        # POST /ask endpoint
└── lib/
    ├── embeddings.js    # OpenAI wrapper
    ├── retrieval.js     # Postgres vector search
    ├── prompt.js        # Build Claude prompt
    └── generate.js      # Claude API call

client/src/
├── App.jsx
└── components/
    ├── SearchBar.jsx
    ├── Filters.jsx
    ├── Answer.jsx
    └── Citations.jsx
```

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://localhost:5432/wms_sop
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional (for production)
PORT=3000
NODE_ENV=development
```

### Deployment Target
- **MVP:** Local development only (Docker Compose)
- **v2:** Deploy to Render/Railway with managed Postgres

### Dependencies (Keep Minimal)
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "pgvector": "^0.1.8",
    "@anthropic-ai/sdk": "^0.20.0",
    "openai": "^4.28.0",
    "pptxgenjs": "^3.12.0",  // or officegen
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.3",
    "concurrently": "^8.2.2"
  }
}
```

## Implementation Notes

### Phase 1: Start with Database Schema
1. Create `scripts/init_db.sql` with exact schema from PRD
2. Test it works: `psql -f scripts/init_db.sql`
3. Only then move to extraction

### Phase 2: Ingestion Pipeline
1. Extract 1-2 PPTX files first (smoke test)
2. Verify JSON output is readable
3. Then embed + ingest to Postgres
4. Query to verify: `SELECT COUNT(*) FROM chunks;`

### Phase 3: Retrieval + Generation
1. Test retrieval with hardcoded query first
2. Log retrieved chunks to console
3. Then add Claude integration
4. Test with sample questions from PRD

### Phase 4: Frontend
1. Build SearchBar + basic form first
2. Test with mock API responses
3. Then connect to real backend
4. Add Citations display last

## When Things Go Wrong

### If Embeddings Are Slow
- Batch embed requests: 100 chunks at a time
- Don't parallelize (OpenAI rate limits)
- Add exponential backoff on 429 errors

### If Retrieval Returns Wrong Docs
- Check module filter is working: `WHERE module = $1`
- Verify embeddings are normalized
- Log similarity scores to debug

### If Claude Returns Invalid JSON
- Check prompt includes clear example
- Log the raw response before parsing
- Use fallback response (don't retry - adds complexity)

### If PPTX Extraction Fails
- Check file exists and is readable
- Try different library (pptxgenjs vs officegen)
- Log slide count to verify extraction worked

## Success Criteria
- Can ingest 10 PPTX files
- Can answer 15 test questions with correct citations
- Response time <3 seconds
- New developer can run from README in <20 min

## What NOT to Build (v2 Features)
- Semantic chunking
- Re-scoring algorithms
- Token budget enforcement
- Automated eval harness
- Debug panels
- Auth/SSO
- Multi-tenant support

Keep it simple. Ship it fast. Learn from users.

---

**Last Updated:** Not yet - update this after every correction from Aaron
