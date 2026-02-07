# Onboarding Feature - Implementation Guide

## What You're Adding

Interactive, step-by-step onboarding that teaches warehouse operators everything they need to know about a module (Picking, Inbound, Outbound, etc.)

**User Experience:**
1. Click "Start Onboarding" button
2. Select module (Picking, Outbound, etc.)
3. Work through 5-7 teaching steps
4. Each step: explanation → checkpoint → next step
5. Complete all steps → celebration message

**Implementation Time: 4-6 hours**

---

## Files You Have

### **Database:**
1. `onboarding-schema.sql` - Tables + sample curriculum

### **Backend:**
2. `onboarding-routes.js` - API endpoints
3. `onboarding-prompt.js` - Teaching-focused prompts

### **Frontend:**
4. `OnboardingMode.jsx` - React component
5. `OnboardingMode.css` - Styling

### **Integration:**
6. `App-integration.jsx` - How to add to existing app
7. `server-integration.js` - How to add routes to Express

### **Documentation:**
8. `CLAUDE-onboarding-additions.md` - Add to your CLAUDE.md

---

## Step-by-Step Implementation

### **Step 1: Database Setup (5 min)**

```bash
# Run the schema
psql -d wms_sop -f onboarding-schema.sql

# Verify curriculum loaded
psql -d wms_sop -c "SELECT module, COUNT(*) FROM onboarding_curriculum GROUP BY module;"

# Should show:
# Picking: 5 steps
# Outbound: 4 steps  
# Inbound: 4 steps
```

---

### **Step 2: Backend Integration (30 min)**

**2a. Add the prompt function:**

```bash
# Copy onboarding-prompt.js content into server/lib/prompt.js
# Add the buildOnboardingPrompt function
# Export it: module.exports = { buildPrompt, buildOnboardingPrompt };
```

**2b. Add the routes:**

```bash
# Create server/routes/onboarding.js
# Copy content from onboarding-routes.js

# Update server/index.js to include:
const onboardingRouter = require('./routes/onboarding');
app.use('/onboarding', onboardingRouter);
```

**2c. Test backend:**

```bash
# Start server
npm run server

# Test endpoint
curl -X POST http://localhost:3000/onboarding/start \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test_user","module":"Picking"}'

# Should return step 1 details
```

---

### **Step 3: Frontend Integration (1 hour)**

**3a. Add OnboardingMode component:**

```bash
# Create client/src/components/OnboardingMode.jsx
# Copy content from OnboardingMode.jsx

# Create client/src/components/OnboardingMode.css
# Copy content from OnboardingMode.css
```

**3b. Update App.jsx:**

Follow the pattern in `App-integration.jsx`:

```jsx
import OnboardingMode from './components/OnboardingMode';
import './components/OnboardingMode.css';

// Add state for mode switching
const [mode, setMode] = useState('chat');

// Add user ID
const [userId] = useState(() => {
  let id = localStorage.getItem('user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('user_id', id);
  }
  return id;
});

// Conditional rendering
if (mode === 'onboarding') {
  return <OnboardingMode userId={userId} onExit={() => setMode('chat')} />;
}

// Add button to header
<button onClick={() => setMode('onboarding')}>
  🎯 Start Onboarding
</button>
```

**3c. Style the trigger button:**

```css
/* Add to your main CSS */
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

---

### **Step 4: Test End-to-End (30 min)**

**Test Flow:**

```
1. Start dev server: npm run dev
2. Open http://localhost:5173
3. Click "Start Onboarding"
4. Select "Picking"
5. Read through Step 1
6. Click "I understand this step"
7. Answer checkpoint question (just think about it)
8. Click "Continue to Next Step"
9. Repeat through all 5 steps
10. See completion message
11. Exit back to chat
12. Restart onboarding for Picking
13. Should see "already completed" OR resume if not finished
```

**Things to verify:**
- [ ] Progress bar updates after each step
- [ ] Citations show correct SOPs
- [ ] Quick tips and common mistakes appear
- [ ] Checkpoint questions make sense
- [ ] Completion message shows at end
- [ ] Can switch back to chat mode
- [ ] Progress persists (refresh page, should resume)

---

### **Step 5: Add More Modules (1 hour)**

The schema only has Picking, Outbound, Inbound. Add more:

```sql
-- For Replenishment module
INSERT INTO onboarding_curriculum (module, step_number, step_title, step_description, search_queries, checkpoint_question) VALUES
('Replenishment', 1, 'Replenishment Basics', 'Understanding when and why to replenish',
 ARRAY['replenishment', 'restock', 'inventory replenishment'],
 'When should you trigger a replenishment?'),
 
('Replenishment', 2, 'Pick Location Selection', 'Choose the right location to replenish from',
 ARRAY['pick location', 'source location', 'replenishment source'],
 'How do you select the source location?');

-- Add 3-5 more steps...
```

**For each module you want to onboard:**
1. List 5-7 essential topics operators must know
2. Write INSERT statements
3. Test: Run onboarding, verify explanations make sense
4. Iterate on search_queries if retrieval misses key info

---

## Customization Options

### **Option 1: Add Quiz Validation**

Currently, checkpoints are self-reported. To add actual validation:

```javascript
// In OnboardingMode.jsx, replace checkbox with answer input

const [userAnswer, setUserAnswer] = useState('');

// When user clicks Continue, send answer to backend
const res = await fetch('/onboarding/validate-answer', {
  method: 'POST',
  body: JSON.stringify({
    user_id: userId,
    step_number: step.step_number,
    user_answer: userAnswer
  })
});

// Backend uses Claude to grade:
const isCorrect = await validateAnswer(
  step.checkpoint_question,
  userAnswer,
  step_chunks // for reference
);
```

**Effort:** +2 hours  
**Value:** Medium (prevents clicking through without learning)

---

### **Option 2: Add Supervisor Dashboard**

Let supervisors see team progress:

```sql
-- New view
CREATE VIEW supervisor_dashboard AS
SELECT 
  p.user_id,
  p.module,
  COALESCE(array_length(p.completed_steps, 1), 0) as completed,
  (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total,
  p.started_at,
  p.last_activity
FROM onboarding_progress p
ORDER BY p.last_activity DESC;
```

```jsx
// New component: SupervisorDashboard.jsx
function SupervisorDashboard() {
  const [progress, setProgress] = useState([]);
  
  useEffect(() => {
    fetch('/onboarding/supervisor/team-progress')
      .then(res => res.json())
      .then(setProgress);
  }, []);
  
  return (
    <table>
      <thead>
        <tr>
          <th>User</th>
          <th>Module</th>
          <th>Progress</th>
          <th>Last Activity</th>
        </tr>
      </thead>
      <tbody>
        {progress.map(p => (
          <tr key={`${p.user_id}-${p.module}`}>
            <td>{p.user_id}</td>
            <td>{p.module}</td>
            <td>{p.completed}/{p.total}</td>
            <td>{new Date(p.last_activity).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Effort:** +3 hours  
**Value:** High (supervisors can track training progress)

---

### **Option 3: Generate Completion Certificates**

```javascript
// After completion, generate PDF certificate

router.post('/complete-step', async (req, res) => {
  // ... existing code ...
  
  if (completed >= total) {
    // Generate certificate
    const cert = await generateCertificate({
      user_id,
      module,
      completed_at: new Date(),
      supervisor_signature: 'Auto-generated' // or require approval
    });
    
    return res.json({
      completed: true,
      certificate_url: cert.url
    });
  }
});
```

**Effort:** +2 hours (using your docx skill)  
**Value:** Medium (nice for compliance, low functional value)

---

## Troubleshooting

### **Issue: Search queries return no results**

**Cause:** Query doesn't match SOP content

**Fix:**
```sql
-- Test your queries manually
SELECT id, doc_title, source_locator, 
       1 - (embedding <=> (SELECT embedding FROM chunks WHERE id = 'test')) AS similarity
FROM chunks
WHERE module = 'Picking'
ORDER BY similarity DESC
LIMIT 5;

-- Update curriculum with better queries
UPDATE onboarding_curriculum
SET search_queries = ARRAY['better', 'search', 'terms']
WHERE module = 'Picking' AND step_number = 2;
```

---

### **Issue: Explanations are too technical**

**Cause:** Prompt tone not adjusted properly

**Fix:**
```javascript
// In buildOnboardingPrompt, emphasize simplicity:
"You are teaching a BRAND NEW warehouse operator.
This is their first week. Use simple language.
Explain jargon before using it."
```

---

### **Issue: Progress not saving**

**Cause:** user_id not consistent

**Fix:**
```javascript
// Make sure user_id persists across sessions
const [userId] = useState(() => {
  let id = localStorage.getItem('user_id');
  if (!id) {
    id = 'user_' + Date.now(); // Use timestamp for uniqueness
    localStorage.setItem('user_id', id);
  }
  return id;
});
```

---

## Success Metrics

After launching, track:

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Completion rate | >70% | Are people finishing? |
| Time to complete | 30-60 min | Is it too long/short? |
| Feedback (thumbs up) | >80% | Is it helpful? |
| Questions to supervisor (before/after) | -50% | Is it reducing support burden? |
| Error rate in first week (before/after) | -30% | Are they learning correctly? |

**How to measure:**
```sql
-- Completion rate
SELECT 
  COUNT(DISTINCT user_id) FILTER (WHERE completed_at IS NOT NULL) * 100.0 /
  COUNT(DISTINCT user_id) as completion_rate
FROM onboarding_progress;

-- Average time to complete
SELECT 
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) as avg_minutes
FROM onboarding_progress
WHERE completed_at IS NOT NULL;
```

---

## Next Steps After Shipping

### **Week 1: Gather Feedback**
- Watch 3-5 operators use it
- Ask: "What was confusing?" "What was helpful?" "What's missing?"
- Update curriculum based on feedback

### **Week 2: Expand Modules**
- Add curriculum for all remaining modules
- Ensure 5-7 steps per module (not too long)

### **Week 3: Add Advanced Features**
- Quiz validation (if operators are clicking through)
- Supervisor dashboard (if supervisors request it)
- Certificates (if compliance needs it)

**Don't build features speculatively. Let usage drive priorities.**

---

## Hand Off to Claude Code

Create this prompt for Claude Code:

```
I need to add an interactive onboarding feature to the WMS SOP Assistant.

Context:
- We already have a working RAG chatbot
- Now we want to add step-by-step training guides for each module
- Users click "Start Onboarding", select a module, and work through predefined steps

Files to review:
1. onboarding-schema.sql (database tables + curriculum)
2. onboarding-routes.js (backend API)
3. onboarding-prompt.js (teaching-focused prompts)
4. OnboardingMode.jsx (React component)
5. *-integration.* files (how to wire it up)
6. CLAUDE-onboarding-additions.md (constraints)

Implementation plan:
1. Run database schema (create tables + sample curriculum)
2. Add backend routes to Express app
3. Add OnboardingMode component to React app
4. Add mode switching in App.jsx
5. Test end-to-end with Picking module

Estimated time: 4-6 hours

Please enter plan mode, review the files, and show me your implementation approach.
```

---

**You're ready to ship this! 🚀**

Questions before you start?
