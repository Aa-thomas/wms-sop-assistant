# WMS SOP Assistant

A RAG chatbot for warehouse operators to search WMS (Warehouse Management System) standard operating procedures. Answers only from indexed SOP content with per-claim citations.

## Architecture

```
User Question
     |
     v
[React UI] --> [Express API] --> [OpenAI Embedding]
                    |                    |
                    v                    v
              [Claude Sonnet]    [Postgres + pgvector]
                    |                    |
                    v                    v
              JSON Response <--- Top 10 Chunks
              (claims + citations)
```

**Stack:** React + Vite | Node + Express | PostgreSQL + pgvector | OpenAI Embeddings | Claude Sonnet 4.5

## Quick Start

### Prerequisites
- Node.js 18+
- Docker
- OpenAI API key
- Anthropic API key

### 1. Start Postgres

```bash
docker compose up -d
```

Wait a few seconds for Postgres to be ready.

### 2. Initialize Database

```bash
PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -f scripts/init_db.sql
```

### 3. Install Dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY=sk-proj-...
#   ANTHROPIC_API_KEY=sk-ant-...
#   DATABASE_URL=postgresql://postgres:dev@localhost:5432/wms_sop
```

### 5. Add SOP Files

Place your `.pptx` SOP files in `data/source/` and update `data/source/index.json` with the file name, document title, and module for each file.

### 6. Extract and Ingest

```bash
npm run extract    # PPTX -> JSON
npm run ingest     # JSON -> Postgres (with OpenAI embeddings)
```

### 7. Start the App

```bash
npm run dev
```

Open http://localhost:5173

## How to Add New SOPs

1. Place the `.pptx` file in `data/source/`
2. Add an entry to `data/source/index.json`:
   ```json
   {
     "file_name": "WMS Tecsys_New SOP_V1.pptx",
     "doc_title": "New SOP V1",
     "module": "Inbound"
   }
   ```
   Allowed modules: `Navigation`, `Inbound`, `Outbound`, `Picking`, `Replenishment`, `Inventory`, `CycleCounts`, `Returns`, `Admin`
3. Run extraction and ingestion:
   ```bash
   npm run extract
   npm run ingest
   ```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend + backend (development) |
| `npm run server` | Start Express API only |
| `npm run client` | Start Vite dev server only |
| `npm run extract` | Extract PPTX files to JSON |
| `npm run ingest` | Embed and load chunks into Postgres |

## Troubleshooting

### Postgres connection fails
- Verify Docker is running: `docker ps`
- Check DATABASE_URL in `.env` includes credentials: `postgresql://postgres:dev@localhost:5432/wms_sop`

### OpenAI quota exceeded
- Add billing credits at https://platform.openai.com/settings/organization/billing/overview
- Embedding 1000 slides costs ~$0.02

### Retrieval returns wrong docs
- Check module filter is working
- Verify embeddings exist: `PGPASSWORD=dev psql -h localhost -U postgres -d wms_sop -c "SELECT COUNT(*) FROM chunks WHERE embedding IS NULL;"`

### Claude returns invalid JSON
- The server strips markdown code fences automatically
- Check server logs for the raw response

## Data Model

**Chunks:** 1 slide = 1 chunk. Each chunk has an embedding (1536 dims), document title, module, slide number, and source locator for citations.

**Feedback:** Thumbs up/down stored in `feedback` table for tracking answer quality.

## Cost Estimate

| Component | Cost |
|-----------|------|
| OpenAI Embeddings (one-time ingestion) | ~$0.02 |
| OpenAI Embeddings (per query) | ~$0.0001 |
| Claude Sonnet (per query) | ~$0.002 |
| Postgres (Docker, local) | Free |
| **Monthly at 50 queries/day** | **~$5** |
