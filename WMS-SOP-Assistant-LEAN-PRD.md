# WMS SOP Assistant - LEAN Build Plan

**Owner:** Aaron  
**Timeline:** ~10 hours to working MVP  
**Philosophy:** Build the simplest thing that works. Ship fast. Learn from real users. Add complexity in v2.

---

## 0) What Success Looks Like (MVP Requirements)

### Must Prove
1. **Grounded answers:** Assistant answers only from indexed WMS SOP content
2. **Citations per claim:** Every bullet has a source reference (SOP + slide number)
3. **Safe failure:** If answer not in SOPs → "Not found in SOPs" + 1 clarifying question
4. **Operator-friendly UX:** Fast search box + optional module filters
5. **Reproducible:** Coworker can run from README in <20 minutes

### Out of Scope (v2 Features)
- ~~Semantic chunking~~ → Use slide-level chunks
- ~~Re-scoring/ranking algorithms~~ → Plain similarity search
- ~~Token budget enforcement~~ → Not needed (chunks are small)
- ~~Automated eval harness~~ → Manual testing is fine
- ~~Debug context panel~~ → Use server logs
- Cross-encoder reranking
- BM25 hybrid search (consider for v2)
- User auth/SSO
- Multi-tenant data separation

---

## 1) Source Data (WMS Only)

### Initial SOP Decks (Start with 6-10)
- WMS Tecsys_Navigation_V2.pptx
- WMS Tecsys_Inbound Order Process_V3.pptx
- WMS Tecsys_Outbound Order Process_V3.pptx
- WMS Tecsys_Picking.pptx
- WMS Tecsys_Replenishment.pptx
- WMS Tecsys_Cycle Counts.pptx
- WMS Tecsys_Customer Returns_V3.pptx
- WMS Tecsys_Inv. Store-Move-Relocation-Adjustments_V1.pptx
- WMS Tecsys_Inventory Labor Management_V1.pptx
- WMS Tecsys_System Administration_Warehouse Setup_V6.pptx

*(Add more later - start with 6-10 decks for MVP)*

### Extraction Expectations
Preserve:
- Slide numbers (operators think in slides)
- Bullet hierarchy
- Headings / step numbers
- Screen/menu/field names

---

## 2) Architecture (Simplified)

### Components
- **Client:** React + Vite (question UI, filters, citations)
- **Server:** Node.js + Express (retrieval, prompt construction)
- **Embeddings:** OpenAI text-embedding-3-small (~$0.01/day)
- **Vector DB:** PostgreSQL + pgvector (free to $15/month)
- **Generator:** Claude Sonnet 4.5 (instruction following + JSON output)

### Request-Time Flow
1. User submits question + optional module filter
2. Server embeds question (OpenAI API)
3. Postgres vector similarity search (ORDER BY embedding <=> query, LIMIT 10)
4. Build prompt with retrieved chunks
5. Claude generates answer using ONLY context
6. Return JSON: answer + citations + follow-up question

### Ingestion Flow (One-Time Setup)
1. PPTX → extract slide text to JSON
2. **One slide = one chunk** (split only if >1500 chars)
3. Embed each chunk
4. INSERT to Postgres with metadata

---

## 3) Data Model (Simplified)

### Chunk Schema (Postgres Table)
```sql
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,              -- stable hash: ${doc_title}_slide_${num}
  text TEXT NOT NULL,               -- slide title + bullets
  embedding vector(1536),           -- OpenAI embedding
  doc_title TEXT NOT NULL,          -- e.g., "Outbound Order Process V3"
  module TEXT NOT NULL,             -- Navigation|Inbound|Outbound|Picking|etc.
  procedure TEXT,                   -- e.g., "Short Pick Processing" (if extractable)
  slide_number INT NOT NULL,        -- slide position in deck
  source_locator TEXT NOT NULL,     -- human-readable: "Outbound V3 - Slide 12"
  tags TEXT[],                      -- keywords: screen names, field names, terms
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_module ON chunks(module);
CREATE INDEX idx_doc_title ON chunks(doc_title);
```

### Citation Format (Returned to UI)
```json
{
  "answer": [
    {
      "claim": "To process a short pick, navigate to the Picking screen...",
      "citations": [
        {
          "doc_title": "Outbound Order Process V3",
          "source_locator": "Slide 12",
          "slide_number": 12
        }
      ]
    }
  ],
  "follow_up_question": "Would you like to know how to handle partial allocations?",
  "coverage": {
    "chunks_used": 3
  }
}
```

---

## 4) Prompting Rules (Grounding Contract)

### System Instructions (Hard Rules)
```
You are a WMS (Warehouse Management System) SOP assistant for warehouse operators.

CRITICAL RULES:
1. Use ONLY the provided context chunks from SOPs
2. If the answer is not in the context:
   - Respond with: "Not found in SOPs"
   - Ask exactly ONE clarifying question to help retrieve better information
3. NO guessing, NO external knowledge, NO "best practices" unless SOP explicitly states it
4. Every claim must include a citation to the source slide

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "answer": [
    {
      "claim": "specific instruction or fact",
      "citations": [
        {
          "doc_title": "exact SOP title",
          "source_locator": "Slide X",
          "slide_number": X
        }
      ]
    }
  ],
  "follow_up_question": "clarifying question or null",
  "coverage": {
    "chunks_used": count
  }
}
```

---

## 5) Repository Structure

```
tecsys-wms-sop-assistant/
├── data/
│   ├── source/                 # Original .pptx files
│   ├── extracted/              # JSON output from extraction
│   └── test-questions.md       # Manual test questions
├── scripts/
│   ├── extract_pptx.js         # PPTX → JSON
│   ├── ingest_postgres.js      # JSON → Postgres chunks
│   └── init_db.sql             # Database schema
├── server/
│   ├── index.js                # Express app
│   ├── routes/
│   │   └── ask.js              # POST /ask endpoint
│   └── lib/
│       ├── embeddings.js       # OpenAI embedding calls
│       ├── retrieval.js        # Postgres vector search
│       ├── prompt.js           # Build Claude prompt
│       └── generate.js         # Claude API call
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   │       ├── SearchBar.jsx
│   │       ├── Filters.jsx
│   │       ├── Answer.jsx
│   │       └── Citations.jsx
├── README.md
├── .env.example
└── package.json
```

---

## 6) Work Plan - LEAN VERSION

**TOTAL TIME: ~10 hours** (vs. 38 hours in original plan)

---

### Phase 1 - Ingestion Pipeline (3 hours)

#### Task 1.1 - Document Inventory (30 min)
**Work:**
- Create `data/source/index.json` listing each deck
- Include: doc_title, module, version, file_path

**Acceptance Criteria:**
- Every deck has required metadata
- Modules match allowed list: Navigation, Inbound, Outbound, Picking, Replenishment, Inventory, CycleCounts, Returns, Admin

**Verification:**
- JSON is valid
- All files exist at specified paths

---

#### Task 1.2 - PPTX Extraction (1.5 hours)
**Work:**
- Implement `scripts/extract_pptx.js`
- Input: `data/source/*.pptx`
- Output: `data/extracted/{deck_name}.json`
- Structure: `{ slides: [{ number, title, bullets: [...] }] }`

**Acceptance Criteria:**
- Slide numbers preserved and sequential
- Text cleaned: normalized whitespace, no empty bullets
- Headings and steps appear in order

**Tests:**
- Run on 2 sample decks
- Confirm output JSON is valid and readable

---

#### Task 1.3 - Slide-to-Chunk Conversion (30 min)
**Work:**
- Simple conversion: **one slide = one chunk**
- Edge case handling: if slide.text.length > 1500 chars → split by step numbers
- Attach metadata: doc_title, module, slide_number, source_locator

**Acceptance Criteria:**
- 95%+ of slides become single chunks
- Chunks are readable (complete thoughts)
- Metadata complete for all chunks

**Tests:**
- Deterministic: same input → same chunk IDs
- Sample 10 chunks: verify slide_number matches content

---

#### Task 1.4 - Postgres Ingestion (30 min)
**Work:**
- Implement `scripts/ingest_postgres.js`
- Initialize DB with `scripts/init_db.sql`
- For each chunk:
  - Call OpenAI embeddings API
  - INSERT into chunks table (upsert on conflict)
- Batch requests (100 chunks at a time)

**Acceptance Criteria:**
- 100% of chunks inserted successfully
- Re-running script is idempotent (same chunk IDs)
- Embeddings index built

**Verification:**
- Query: `SELECT COUNT(*) FROM chunks;` → matches expected count
- Test query: search for known term, verify results

---

### Phase 2 - Retrieval + Generation (2 hours)

#### Task 2.1 - Basic Retrieval (30 min)
**Work:**
- Implement `server/lib/retrieval.js`
- Embed user question (OpenAI API)
- Query Postgres:
  ```sql
  SELECT id, text, doc_title, source_locator, slide_number,
         1 - (embedding <=> $1) AS similarity
  FROM chunks
  WHERE module = $2 OR $2 IS NULL
  ORDER BY embedding <=> $1
  LIMIT 10
  ```
- Return top 10 chunks

**Acceptance Criteria:**
- Retrieval supports optional module filter
- Returns results in <100ms (for 2,500 chunks)
- Stable ordering for identical queries

**Tests:**
- Test 5 sample questions
- Verify correct module chunks appear in results

---

#### Task 2.2 - Prompt Construction (30 min)
**Work:**
- Implement `server/lib/prompt.js`
- Build context from retrieved chunks:
  ```
  [Slide X from {doc_title}]
  {chunk.text}
  ```
- Add grounding contract (system instructions from Section 4)
- Include JSON output schema

**Acceptance Criteria:**
- Prompt always includes grounding rules
- Context includes all retrieved chunks
- Schema is clear and includes example

**Tests:**
- Log generated prompt for sample question
- Verify structure is correct

---

#### Task 2.3 - Claude Generation (1 hour)
**Work:**
- Implement `server/lib/generate.js`
- Call Claude Sonnet 4.5 API
- Parse JSON response with try-catch:
  ```javascript
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
  ```

**Acceptance Criteria:**
- API returns valid JSON 99%+ of time
- Parse failures logged for debugging
- Safe fallback response on errors

**Tests:**
- Test with 5 sample questions
- Verify JSON structure matches schema
- Check citations reference correct slides

---

#### Task 2.4 - /ask API Endpoint (bonus - included in 2.3)
**Work:**
- Implement `POST /ask` in `server/routes/ask.js`
- Body: `{ question: string, module?: string }`
- Response: JSON from Claude
- Basic validation: reject empty questions, questions >500 chars

**Acceptance Criteria:**
- Returns 200 with valid response
- Returns 400 for invalid input
- Handles errors gracefully

---

### Phase 3 - Frontend (3 hours)

#### Task 3.1 - Question UI + Filters (1.5 hours)
**Work:**
- React page with:
  - Text input for question
  - Dropdown for module filter (optional)
  - Submit button
  - Loading state during request

**Acceptance Criteria:**
- Works on mobile and desktop
- Module filter affects API request
- Loading state prevents duplicate submissions

**Verification:**
- Test on phone screen
- Ask same question with different filters

---

#### Task 3.2 - Answer + Citations Display (1.5 hours)
**Work:**
- Render each claim as bullet with inline citations
- Citations show: "{doc_title} - Slide {number}"
- "Show sources" toggle reveals full chunk text (optional)

**Acceptance Criteria:**
- Every claim has ≥1 citation
- Citations are clickable (future: link to actual SOP)
- Clean, readable formatting

**Verification:**
- Ask 3 test questions
- Copy citation → search in SOP deck → verify it's correct slide

---

### Phase 4 - Ship Readiness (2 hours)

#### Task 4.1 - Manual Test Questions (30 min)
**Work:**
- Create `data/test-questions.md` with 15-20 real operator questions
- Organize by module
- Include edge cases:
  - Ambiguous questions
  - Out-of-scope questions (should trigger "Not found")
  - Multi-step procedures

**Example:**
```markdown
## Inbound
- How do I receive an inbound order?
- What do I do if the quantity doesn't match the PO?

## Outbound
- How do I process a short pick?
- What screen do I use for order allocation?

## Out of Scope (should fail safely)
- What's the weather today?
- How do I file my taxes?
```

**Acceptance Criteria:**
- Questions come from actual warehouse scenarios
- Cover all major modules
- Include negative test cases

**Testing:**
- Manually ask each question
- Check: answer quality, citation accuracy
- Note: what needs improvement

---

#### Task 4.2 - README + Runbook (1.5 hours)
**Work:**
- Write `README.md` with:
  - What it does (1 paragraph)
  - Architecture diagram (simple text/ASCII)
  - Setup instructions:
    ```bash
    # 1. Install dependencies
    npm install
    
    # 2. Set up Postgres
    docker run -d -p 5432:5432 \
      -e POSTGRES_PASSWORD=dev \
      -e POSTGRES_DB=wms_sop \
      postgres:16
    
    # 3. Initialize database
    psql -d wms_sop -f scripts/init_db.sql
    
    # 4. Set environment variables
    cp .env.example .env
    # Edit .env with your API keys
    
    # 5. Ingest SOPs
    npm run extract
    npm run ingest
    
    # 6. Start server
    npm run dev
    ```
  - How to add new SOP decks
  - Troubleshooting common issues

**Acceptance Criteria:**
- New developer can run from scratch in <20 min
- All commands tested and working
- Environment variables documented

---

### Task 4.3 - Feedback Collection (30 min - NEW)
**Work:**
- Add feedback endpoint: `POST /feedback`
- Store in Postgres:
  ```sql
  CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    question TEXT,
    response_id TEXT,
    helpful BOOLEAN,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```
- Add thumbs up/down buttons to UI

**Why This Matters:**
- Know which questions fail
- Know when to add SOPs
- Data to justify v2 features

**Acceptance Criteria:**
- Feedback stored successfully
- Can query: `SELECT * FROM feedback WHERE helpful = false;`

---

## 7) Definition of Done

The MVP is **shippable** when:

✅ Ingestion works end-to-end on 6-10 WMS SOPs  
✅ `/ask` returns grounded JSON with citations  
✅ UI shows citations per claim  
✅ Safe failure works ("Not found in SOPs" + follow-up)  
✅ README complete, new dev can run in <20 min  
✅ Manual testing completed on 15+ questions  
✅ Feedback collection working  

---

## 8) Command Plan (package.json scripts)

```json
{
  "scripts": {
    "extract": "node scripts/extract_pptx.js",
    "ingest": "node scripts/ingest_postgres.js",
    "dev": "concurrently \"npm:server\" \"npm:client\"",
    "server": "nodemon server/index.js",
    "client": "cd client && vite"
  }
}
```

---

## 9) Demo Script (2 minutes)

1. **Filter by module:** Select "Outbound"
2. **Ask:** "How do I process a short pick?"
3. **Show answer** with inline citations
4. **Click citation** → shows "Outbound Order Process V3 - Slide 12"
5. **Ask out-of-scope:** "What's the weather today?"
6. **Verify safe failure:** "Not found in SOPs. Are you looking for information about warehouse procedures or WMS system operations?"

---

## 10) Cost Estimate

| Component | Cost |
|-----------|------|
| OpenAI Embeddings (ingestion) | ~$0.15 one-time |
| OpenAI Embeddings (queries) | ~$0.01/day |
| Claude API (queries) | ~$0.10/day (at 50 queries) |
| Postgres (Supabase free tier) | $0 (up to 500MB) |
| **Total Monthly** | **~$3-5/month** |

At scale (1000 queries/day): ~$30-40/month

---

## 11) v2 Roadmap (Based on User Feedback)

Build these ONLY if users request them:

### Retrieval Improvements
- Hybrid search (BM25 + vector)
- Re-scoring with metadata boosts
- Cross-encoder reranking

### UX Enhancements
- Link citations directly to SOP slides (if SOPs are in SharePoint/Google Drive)
- Conversation history
- Multi-turn clarification dialogs

### Operations
- Automated eval harness (when you have >50 test questions)
- A/B testing framework
- Usage analytics dashboard

### Scale
- Multi-language support (if French SOPs needed)
- Multi-tenant isolation (if rolling out to other warehouses)
- SSO/auth (if security team requires it)

---

## 12) Success Metrics (After 30 Days)

**Track these to decide what to build next:**

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Daily active users | 10+ | Proves adoption |
| Thumbs up rate | >70% | Proves answers are helpful |
| "Not found" rate | <20% | Proves SOP coverage is good |
| Avg. response time | <3 sec | Proves performance is acceptable |
| Questions per user | >5/week | Proves tool is sticky |

**Decision Tree:**
- If thumbs-down rate >30% → improve retrieval (add hybrid search)
- If "not found" rate >30% → add more SOPs
- If response time >5 sec → optimize (caching, faster embeddings)
- If adoption low (<5 DAU) → improve UX or marketing

---

## Changes from Original Plan

### ✂️ Cut (Time Saved: ~28 hours)
- ~~Semantic chunking~~ → slide-level chunks (saved 10 hrs)
- ~~Re-scoring logic~~ → plain similarity (saved 4 hrs)
- ~~Token budget enforcement~~ → not needed (saved 3 hrs)
- ~~JSON retry logic~~ → simple try-catch (saved 2 hrs)
- ~~Automated eval harness~~ → manual testing (saved 6 hrs)
- ~~Debug context panel~~ → server logs (saved 3 hrs)

### ➕ Added
- Feedback collection (30 min)
- Postgres instead of Pinecone (no change in time, better long-term)

### Result
- **Original estimate:** 38 hours over 2 weeks
- **Lean estimate:** 10 hours over 2-3 days
- **Time saved:** 70%

---

## Philosophy: Ship to Learn

> "Make it work, make it right, make it fast" — Kent Beck

**Week 1:** Build this lean MVP (10 hrs)  
**Week 2:** Get 5 operators to test it (2 hrs training)  
**Week 3:** Analyze feedback, prioritize v2 features (2 hrs)  
**Week 4:** Ship highest-impact improvements

Don't build features you *think* users need.  
Build the minimum, then let real usage guide v2.

---

**Ready to ship? Let's build this thing. 🚀**
