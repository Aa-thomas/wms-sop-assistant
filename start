# Initial Prompt for Claude Code

Hi Claude Code! I need you to build a WMS SOP Assistant following the LEAN Build Plan.

## Context
This is a RAG chatbot for warehouse operators to search WMS (Warehouse Management System) standard operating procedures. It MUST answer only from indexed content (no hallucinations) and cite sources.

## Your Mission
Build a working MVP in ~10 hours following the implementation-plan.md

## Critical Files to Read First
1. **CLAUDE.md** - Your constraints and coding patterns (READ THIS FIRST)
2. **WMS-SOP-Assistant-LEAN-PRD.md** - Full specification
3. **implementation-plan.md** - Detailed build steps
4. **test-questions.md** - Test cases to validate

## Strategy (Following Boris Cherny's Tips)

### Use Plan Mode
1. Read all 4 files above
2. Enter plan mode and create a detailed implementation plan
3. Break down each phase into concrete tasks
4. Get my approval before starting implementation

### Build Order
**Phase 1:** Database + Ingestion (2.5 hrs)
- Create schema
- PPTX extraction
- Embedding + Postgres insert

**Phase 2:** Backend API (2 hrs)
- Retrieval function
- Prompt builder
- Claude generation
- Express endpoints

**Phase 3:** Frontend (2.5 hrs)
- Search UI
- Answer display
- Citations
- Feedback buttons

**Phase 4:** Documentation (2 hrs)
- README
- Manual testing

### Key Principles
- ✅ **Keep it simple** - No premature optimization
- ✅ **Test as you build** - Verify each phase works before moving on
- ✅ **One slide = one chunk** - No complex semantic chunking
- ✅ **Plain similarity search** - No re-scoring algorithms
- ✅ **Postgres + pgvector** - Not Pinecone, not SQLite
- ✅ **Manual testing** - No automated eval harness for MVP

### Common Mistakes to Avoid
(All listed in CLAUDE.md - read it!)
- ❌ Don't build semantic chunking
- ❌ Don't add re-scoring logic
- ❌ Don't add token budget enforcement
- ❌ Don't use retry loops for JSON parsing
- ❌ Don't build automated eval harness

## First Steps
1. Read CLAUDE.md (most important)
2. Read implementation-plan.md
3. Enter plan mode
4. Show me your implementation plan
5. Wait for my approval
6. Then start building Phase 1

## Questions?
Ask me before making any architectural decisions not covered in CLAUDE.md

Let's build this! 🚀
