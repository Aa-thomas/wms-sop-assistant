# Plan: Integrate Onboarding v1

## Context
The onboarding feature is fully written in `wms-assistant-onboarding/` but hasn't been integrated into the app. This plan wires up the existing code — database schema, backend routes, prompt function, and React component — into the running application.

The v2 plan (supervisor dashboard, quiz validation, certificates, spaced repetition) explicitly says to wait until v1 has real usage data. This plan covers v1 only.

---

## Testing Strategy

### Setup (first steps before any code changes)

1. **Add Playwright MCP server** to the project:
   ```
   claude mcp add --transport stdio --scope project playwright -- npx -y @playwright/mcp@latest
   ```
   This gives me tools to: launch a browser, navigate to URLs, take screenshots, click elements, fill forms, and read page content.

2. **Enable Chrome integration** for real-time visual verification:
   ```
   /chrome → select "Enabled by default"
   ```
   This lets me open a visible Chrome window so you can watch the testing happen live.

3. **Ensure services are running** before each verification stage:
   - Postgres: `docker compose up -d`
   - Backend: `npm run server` (port 3000)
   - Frontend: `npm run client` (port 5173)

### Stage-by-Stage Verification

Each implementation step has a corresponding verification gate. I won't proceed to the next step until the current gate passes.

| Stage | What's Built | Verification |
|-------|-------------|--------------|
| **1. Database** | Schema + curriculum | `psql` query: confirm 3 modules, 13 total steps |
| **2. Backend** | db.js, prompt, routes | `curl POST /onboarding/available` returns 3 modules; `curl POST /onboarding/start` returns step 1 |
| **3. Frontend** | Components + App.jsx wiring | Playwright: navigate to localhost:5173, screenshot, verify "Start Onboarding" button visible |
| **4. Module selection** | Click into onboarding | Playwright: click "Start Onboarding", screenshot, verify module cards (Picking, Outbound, Inbound) appear |
| **5. Step flow** | Start Picking module | Playwright: click "Start Learning" on Picking, screenshot, verify step 1 title + explanation + progress bar |
| **6. Checkpoint** | Complete a step | Playwright: click "I understand", screenshot checkpoint question, click "Continue", verify step 2 loads |
| **7. Exit flow** | Return to chat | Playwright: click "Exit Onboarding", screenshot, verify chat interface is back |
| **8. Resume** | Re-enter after exit | Playwright: click "Start Onboarding" → Picking again, verify it resumes (not restarts) |

### What Playwright MCP Gives Me

At each gate I can:
- **`browser_navigate`** — go to `http://localhost:5173`
- **`browser_screenshot`** — capture what the page looks like (I can see the image)
- **`browser_click`** — click buttons/links by text or selector
- **`browser_type`** — fill in form fields
- **`browser_snapshot`** — get the accessibility tree (DOM structure without needing vision)

This means I can catch: broken layouts, missing buttons, wrong text, failed API calls (via error states in the UI), and broken navigation between modes.

---

## What Already Exists (in `wms-assistant-onboarding/`)

| File | Contains |
|------|----------|
| `onboarding-schema.sql` | `onboarding_curriculum` + `onboarding_progress` tables, sample curriculum (Picking 5 steps, Outbound 4, Inbound 4), `get_next_onboarding_step()` function |
| `onboarding-routes.js` | Express routes: POST /start, POST /step, POST /complete-step, GET /progress/:user_id, GET /available |
| `onboarding-prompt.js` | `buildOnboardingPrompt()` function for teaching-focused Claude prompts |
| `OnboardingMode.jsx` | React component: module selector grid, step view with progress bar, explanation display, checkpoint flow |
| `OnboardingMode.css` | Full styling for onboarding UI |

---

## Reference: Key Existing Code

### Database connection pattern (`server/lib/retrieval.js`)
- Currently uses inline `new Pool({ connectionString: process.env.DATABASE_URL })`
- No shared `server/lib/db.js` module exists — onboarding routes expect one
- `retrieval.js` also registers pgvector type on first connection

### Prompt module (`server/lib/prompt.js`)
- Exports: `{ buildPrompt }`
- Onboarding prompt function needs to be added here

### Generate module (`server/lib/generate.js`)
- Uses Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- Strips markdown code fences, parses JSON, returns fallback on parse failure
- Onboarding routes call `generate()` directly — no changes needed

### Express app (`server/index.js`)
- Currently mounts: cors, json parser, static `/images`, and ask routes
- Onboarding router needs to be added at `/onboarding`

### Vite proxy (`client/vite.config.js`)
- Proxies: `/ask`, `/feedback`, `/health`, `/images` → localhost:3000
- `/onboarding` needs to be added

### Frontend (`client/src/App.jsx`)
- State: response, loading, error, lastQuestion
- No mode switching, no userId
- Renders: header → SearchBar → loading/error → Answer

---

## Integration Steps

### Step 1: Run database schema
- Execute `wms-assistant-onboarding/onboarding-schema.sql` against the wms_sop database
- **Gate:** `SELECT module, COUNT(*) FROM onboarding_curriculum GROUP BY module;` → Picking: 5, Outbound: 4, Inbound: 4

### Step 2: Create `server/lib/db.js` (shared DB pool)
- The onboarding routes import `require('../lib/db')` which doesn't exist
- The app currently creates `Pool` instances inline (in `retrieval.js` and `ask.js`)
- Create a shared `db.js` that exports the pool, then update `retrieval.js` to use it
- This avoids duplicating connection pools

**`server/lib/db.js`:**
```js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = pool;
```

**Update `server/lib/retrieval.js`:** Replace inline `new Pool()` with `require('./db')`

### Step 3: Add `buildOnboardingPrompt` to `server/lib/prompt.js`
- Copy the function from `wms-assistant-onboarding/onboarding-prompt.js`
- Add to existing `module.exports`: `{ buildPrompt, buildOnboardingPrompt }`

### Step 4: Create `server/routes/onboarding.js`
- Copy from `wms-assistant-onboarding/onboarding-routes.js`
- The `require('../lib/db')` import will work after step 2
- The routes already import `retrieve` from `../lib/retrieval` and `generate` from `../lib/generate`

### Step 5: Wire routes into `server/index.js`
- Add: `const onboardingRouter = require('./routes/onboarding');`
- Add: `app.use('/onboarding', onboardingRouter);`
- **Gate:** `curl` tests against /onboarding/available and /onboarding/start

### Step 6: Add frontend component files
- Copy `wms-assistant-onboarding/OnboardingMode.jsx` → `client/src/components/OnboardingMode.jsx`
- Copy `wms-assistant-onboarding/OnboardingMode.css` → `client/src/components/OnboardingMode.css`

### Step 7: Update `client/src/App.jsx`
- Import `OnboardingMode` and its CSS
- Add `mode` state: `const [mode, setMode] = useState('chat');`
- Add `userId` from localStorage:
  ```js
  const [userId] = useState(() => {
    let id = localStorage.getItem('user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('user_id', id);
    }
    return id;
  });
  ```
- Add "Start Onboarding" button in header
- Conditional render: if mode === 'onboarding', render `<OnboardingMode userId={userId} onExit={() => setMode('chat')} />`; otherwise render existing chat UI

### Step 8: Add onboarding trigger button CSS to `client/src/App.css`
```css
.onboarding-trigger-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  margin-left: 1rem;
}
.onboarding-trigger-btn:hover {
  background: #45a049;
}
```

### Step 9: Update `client/vite.config.js`
- Add `/onboarding` to the proxy config (same pattern as `/ask`, `/images`)
- **Gate:** Playwright + Chrome visual verification of full onboarding flow (stages 3-8 from verification table above)

---

## Files Modified
- **`server/lib/db.js`** — new (shared Pool export)
- **`server/lib/retrieval.js`** — use shared db pool instead of inline Pool
- **`server/lib/prompt.js`** — add `buildOnboardingPrompt` function
- **`server/routes/onboarding.js`** — new (copied + adapted from `wms-assistant-onboarding/onboarding-routes.js`)
- **`server/index.js`** — mount onboarding router at `/onboarding`
- **`client/src/components/OnboardingMode.jsx`** — new (copied from `wms-assistant-onboarding/OnboardingMode.jsx`)
- **`client/src/components/OnboardingMode.css`** — new (copied from `wms-assistant-onboarding/OnboardingMode.css`)
- **`client/src/App.jsx`** — add mode switching, userId, onboarding button
- **`client/src/App.css`** — add `.onboarding-trigger-btn` style
- **`client/vite.config.js`** — add `/onboarding` proxy
