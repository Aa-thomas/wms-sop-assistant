# Onboarding Feature v2 - Advanced Enhancements

**⚠️ IMPORTANT: DO NOT BUILD THESE UNTIL v1 IS COMPLETE AND VALIDATED**

**Build Trigger:** After v1 has been used by 10+ operators for 2+ weeks and you have feedback data.

**Why Wait:**
- You don't know which features users actually want yet
- Building speculatively wastes time
- Real usage will reveal different priorities than you expect
- v1 might be sufficient (don't over-engineer)

**Decision Point:** Review feedback, track metrics, THEN decide which v2 features to build.

---

## v2 Feature Checklist

After v1 ships, you should:

- [ ] Get 10+ operators to complete onboarding
- [ ] Collect feedback (what was helpful? what was confusing?)
- [ ] Track metrics (completion rate, time to complete, questions to supervisors)
- [ ] Review this document
- [ ] Prioritize v2 features based on ACTUAL need, not assumptions
- [ ] Build the highest-impact feature first

---

## v2 Feature Options (Ranked by Likely Impact)

### **Feature 1: Supervisor Dashboard** ⭐⭐⭐⭐⭐
**Impact:** High  
**Effort:** 3 hours  
**Build Priority:** #1 (build this first if supervisors request it)

**Why This Matters:**
- Supervisors need to know: "Is my team trained?"
- Enables accountability (who hasn't finished?)
- Identifies struggling operators early
- Compliance documentation (prove training completed)

**User Story:**
> As a warehouse supervisor, I want to see which team members have completed onboarding for each module, so I can ensure everyone is properly trained before assigning tasks.

---

#### Implementation Plan

**Database Schema:**
```sql
-- No new tables needed! Just query existing data

-- View for supervisor dashboard
CREATE VIEW supervisor_onboarding_dashboard AS
SELECT 
  p.user_id,
  p.module,
  p.started_at,
  p.completed_at,
  COALESCE(array_length(p.completed_steps, 1), 0) as steps_completed,
  (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
  ROUND(
    COALESCE(array_length(p.completed_steps, 1), 0)::NUMERIC / 
    (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) * 100,
    1
  ) as completion_percentage,
  p.last_activity,
  CASE 
    WHEN p.completed_at IS NOT NULL THEN 'Completed'
    WHEN p.last_activity < NOW() - INTERVAL '7 days' THEN 'Stalled'
    WHEN p.last_activity > NOW() - INTERVAL '1 day' THEN 'Active'
    ELSE 'In Progress'
  END as status
FROM onboarding_progress p
ORDER BY p.last_activity DESC;

-- Function: Get team summary by module
CREATE OR REPLACE FUNCTION get_module_summary(p_module TEXT DEFAULT NULL)
RETURNS TABLE (
  module TEXT,
  total_users INT,
  completed_users INT,
  in_progress_users INT,
  stalled_users INT,
  avg_completion_days NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.module,
    COUNT(DISTINCT d.user_id)::INT as total_users,
    COUNT(DISTINCT d.user_id) FILTER (WHERE d.completed_at IS NOT NULL)::INT as completed_users,
    COUNT(DISTINCT d.user_id) FILTER (WHERE d.completed_at IS NULL AND d.last_activity > NOW() - INTERVAL '7 days')::INT as in_progress_users,
    COUNT(DISTINCT d.user_id) FILTER (WHERE d.completed_at IS NULL AND d.last_activity < NOW() - INTERVAL '7 days')::INT as stalled_users,
    ROUND(AVG(EXTRACT(EPOCH FROM (d.completed_at - d.started_at))/86400), 1) as avg_completion_days
  FROM supervisor_onboarding_dashboard d
  WHERE p_module IS NULL OR d.module = p_module
  GROUP BY d.module
  ORDER BY total_users DESC;
END;
$$ LANGUAGE plpgsql;
```

**Backend API:**
```javascript
// server/routes/onboarding.js - Add these endpoints

/**
 * GET /onboarding/supervisor/dashboard
 * Get complete team onboarding status
 * 
 * Returns: [ { user_id, module, status, progress, last_activity } ]
 */
router.get('/supervisor/dashboard', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM supervisor_onboarding_dashboard'
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

/**
 * GET /onboarding/supervisor/summary
 * Get aggregated statistics by module
 * 
 * Query params: ?module=Picking (optional)
 * Returns: { module, total_users, completed, in_progress, stalled }
 */
router.get('/supervisor/summary', async (req, res) => {
  const { module } = req.query;
  
  try {
    const result = await db.query(
      'SELECT * FROM get_module_summary($1)',
      [module || null]
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting summary:', error);
    return res.status(500).json({ error: 'Failed to load summary' });
  }
});

/**
 * GET /onboarding/supervisor/user/:user_id
 * Get detailed progress for a specific user
 * 
 * Returns: [ { module, steps, last_step_title, completion_percentage } ]
 */
router.get('/supervisor/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  try {
    const result = await db.query(
      `SELECT 
        p.module,
        p.completed_steps,
        p.current_step,
        (SELECT step_title FROM onboarding_curriculum 
         WHERE module = p.module AND step_number = p.current_step) as current_step_title,
        COALESCE(array_length(p.completed_steps, 1), 0) as completed_count,
        (SELECT COUNT(*) FROM onboarding_curriculum c WHERE c.module = p.module) as total_steps,
        p.started_at,
        p.completed_at,
        p.last_activity
       FROM onboarding_progress p
       WHERE p.user_id = $1
       ORDER BY p.last_activity DESC`,
      [user_id]
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting user details:', error);
    return res.status(500).json({ error: 'Failed to load user details' });
  }
});
```

**Frontend Component:**
```jsx
// client/src/components/SupervisorDashboard.jsx

import React, { useState, useEffect } from 'react';
import './SupervisorDashboard.css';

export default function SupervisorDashboard() {
  const [dashboard, setDashboard] = useState([]);
  const [summary, setSummary] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Load dashboard data
  useEffect(() => {
    loadDashboard();
    loadSummary();
  }, []);
  
  const loadDashboard = async () => {
    try {
      const res = await fetch('/onboarding/supervisor/dashboard');
      const data = await res.json();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadSummary = async (module = null) => {
    try {
      const url = module 
        ? `/onboarding/supervisor/summary?module=${module}`
        : '/onboarding/supervisor/summary';
      const res = await fetch(url);
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };
  
  const loadUserDetails = async (userId) => {
    try {
      const res = await fetch(`/onboarding/supervisor/user/${userId}`);
      const data = await res.json();
      setUserDetails(data);
      setSelectedUser(userId);
    } catch (error) {
      console.error('Failed to load user details:', error);
    }
  };
  
  // Filter dashboard by module
  const filteredDashboard = selectedModule
    ? dashboard.filter(d => d.module === selectedModule)
    : dashboard;
  
  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }
  
  return (
    <div className="supervisor-dashboard">
      <h1>Team Onboarding Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="summary-cards">
        {summary.map(s => (
          <div 
            key={s.module} 
            className="summary-card"
            onClick={() => {
              setSelectedModule(selectedModule === s.module ? null : s.module);
              loadSummary(selectedModule === s.module ? null : s.module);
            }}
          >
            <h3>{s.module}</h3>
            <div className="metric">
              <span className="number">{s.completed_users}</span>
              <span className="label">Completed</span>
            </div>
            <div className="metric">
              <span className="number">{s.in_progress_users}</span>
              <span className="label">In Progress</span>
            </div>
            {s.stalled_users > 0 && (
              <div className="metric warning">
                <span className="number">{s.stalled_users}</span>
                <span className="label">Stalled (>7 days)</span>
              </div>
            )}
            {s.avg_completion_days && (
              <div className="avg-time">
                Avg: {s.avg_completion_days} days to complete
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Filter */}
      {selectedModule && (
        <div className="filter-badge">
          Showing: {selectedModule}
          <button onClick={() => setSelectedModule(null)}>× Clear</button>
        </div>
      )}
      
      {/* Team Progress Table */}
      <table className="progress-table">
        <thead>
          <tr>
            <th>User ID</th>
            <th>Module</th>
            <th>Progress</th>
            <th>Status</th>
            <th>Started</th>
            <th>Completed</th>
            <th>Last Activity</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredDashboard.map(item => (
            <tr key={`${item.user_id}-${item.module}`}>
              <td>{item.user_id}</td>
              <td>{item.module}</td>
              <td>
                <div className="progress-bar-cell">
                  <div 
                    className="progress-fill-cell" 
                    style={{ width: `${item.completion_percentage}%` }}
                  />
                  <span className="progress-text">
                    {item.steps_completed}/{item.total_steps} ({item.completion_percentage}%)
                  </span>
                </div>
              </td>
              <td>
                <span className={`status-badge ${item.status.toLowerCase().replace(' ', '-')}`}>
                  {item.status}
                </span>
              </td>
              <td>{new Date(item.started_at).toLocaleDateString()}</td>
              <td>
                {item.completed_at 
                  ? new Date(item.completed_at).toLocaleDateString()
                  : '-'
                }
              </td>
              <td>{new Date(item.last_activity).toLocaleDateString()}</td>
              <td>
                <button 
                  onClick={() => loadUserDetails(item.user_id)}
                  className="details-btn"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {filteredDashboard.length === 0 && (
        <div className="no-data">
          No onboarding data {selectedModule ? `for ${selectedModule}` : ''} yet.
        </div>
      )}
      
      {/* User Details Modal */}
      {selectedUser && userDetails && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Onboarding Details: {selectedUser}</h2>
            <button 
              className="close-modal"
              onClick={() => setSelectedUser(null)}
            >
              ×
            </button>
            
            {userDetails.map(detail => (
              <div key={detail.module} className="user-detail-card">
                <h3>{detail.module}</h3>
                <p>
                  <strong>Progress:</strong> {detail.completed_count}/{detail.total_steps} steps
                </p>
                {!detail.completed_at && detail.current_step_title && (
                  <p>
                    <strong>Current Step:</strong> {detail.current_step_title}
                  </p>
                )}
                <p>
                  <strong>Started:</strong> {new Date(detail.started_at).toLocaleString()}
                </p>
                {detail.completed_at && (
                  <p>
                    <strong>Completed:</strong> {new Date(detail.completed_at).toLocaleString()}
                  </p>
                )}
                <p>
                  <strong>Last Activity:</strong> {new Date(detail.last_activity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**CSS Styles:**
```css
/* client/src/components/SupervisorDashboard.css */

.supervisor-dashboard {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.supervisor-dashboard h1 {
  margin-bottom: 2rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.summary-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.summary-card:hover {
  border-color: #4CAF50;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.summary-card h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0.5rem 0;
}

.metric .number {
  font-size: 1.5rem;
  font-weight: 600;
  color: #4CAF50;
}

.metric.warning .number {
  color: #ff9800;
}

.metric .label {
  color: #666;
  font-size: 0.9rem;
}

.avg-time {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
  color: #666;
  font-size: 0.85rem;
}

.filter-badge {
  background: #e3f2fd;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-badge button {
  background: none;
  border: none;
  color: #1976D2;
  font-size: 1.2rem;
  cursor: pointer;
}

.progress-table {
  width: 100%;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.progress-table th {
  background: #f5f5f5;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #e0e0e0;
}

.progress-table td {
  padding: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.progress-bar-cell {
  position: relative;
  height: 30px;
  background: #e0e0e0;
  border-radius: 15px;
  overflow: hidden;
}

.progress-fill-cell {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-badge.completed {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.active {
  background: #e3f2fd;
  color: #1976D2;
}

.status-badge.in-progress {
  background: #fff3e0;
  color: #f57c00;
}

.status-badge.stalled {
  background: #ffebee;
  color: #c62828;
}

.details-btn {
  padding: 0.5rem 1rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.details-btn:hover {
  background: #1976D2;
}

.no-data {
  text-align: center;
  padding: 3rem;
  color: #999;
  font-style: italic;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}

.close-modal {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #999;
}

.close-modal:hover {
  color: #333;
}

.user-detail-card {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
}

.user-detail-card h3 {
  margin: 0 0 0.5rem 0;
}

.user-detail-card p {
  margin: 0.5rem 0;
}
```

**Integration:**
```jsx
// client/src/App.jsx - Add route

import SupervisorDashboard from './components/SupervisorDashboard';

// Add button in header
<button onClick={() => navigate('/supervisor')}>
  📊 Supervisor Dashboard
</button>

// Add route
<Route path="/supervisor" element={<SupervisorDashboard />} />
```

**Testing:**
1. Complete onboarding for 3+ test users at different stages
2. Open supervisor dashboard
3. Verify summary cards show correct counts
4. Click module to filter
5. Click "Details" on a user
6. Verify all data is accurate

**Success Metrics:**
- Supervisors check dashboard 2+ times per week
- Stalled users (>7 days inactive) get re-engaged
- Training completion rate improves 20%+

---

### **Feature 2: Quiz Validation** ⭐⭐⭐⭐
**Impact:** Medium-High  
**Effort:** 2 hours  
**Build Priority:** #2 (build if operators are clicking through without learning)

**Why This Matters:**
- Prevents "checkbox syndrome" (clicking through without reading)
- Validates actual understanding
- Identifies knowledge gaps
- Increases retention (active recall)

**User Story:**
> As a warehouse supervisor, I want operators to prove they understand each step before moving on, so I know they're actually learning (not just clicking through).

---

#### Implementation Plan

**Database Schema:**
```sql
-- Store quiz attempts
CREATE TABLE onboarding_quiz_attempts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  module TEXT NOT NULL,
  step_number INT NOT NULL,
  question TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  feedback TEXT,
  attempt_number INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user ON onboarding_quiz_attempts(user_id, module);
```

**Backend API:**
```javascript
// server/routes/onboarding.js - Add quiz validation

/**
 * POST /onboarding/validate-answer
 * Validate user's answer to checkpoint question
 * 
 * Body: { user_id, module, step_number, user_answer }
 * Returns: { is_correct, feedback, can_proceed }
 */
router.post('/validate-answer', async (req, res) => {
  const { user_id, module, step_number, user_answer } = req.body;
  
  try {
    // Get step info
    const stepResult = await db.query(
      `SELECT checkpoint_question, search_queries 
       FROM onboarding_curriculum 
       WHERE module = $1 AND step_number = $2`,
      [module, step_number]
    );
    
    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'Step not found' });
    }
    
    const step = stepResult.rows[0];
    
    // Retrieve relevant chunks for context
    const allChunks = [];
    for (const query of step.search_queries) {
      const chunks = await retrieve(query, module);
      allChunks.push(...chunks);
    }
    
    const uniqueChunks = Array.from(
      new Map(allChunks.map(c => [c.id, c])).values()
    ).slice(0, 5);
    
    // Build validation prompt
    const prompt = buildQuizValidationPrompt(
      step.checkpoint_question,
      user_answer,
      uniqueChunks
    );
    
    // Get Claude's assessment
    const validation = await generate(prompt);
    
    // Count attempts
    const attemptsResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM onboarding_quiz_attempts 
       WHERE user_id = $1 AND module = $2 AND step_number = $3`,
      [user_id, module, step_number]
    );
    
    const attemptNumber = parseInt(attemptsResult.rows[0].count) + 1;
    
    // Store attempt
    await db.query(
      `INSERT INTO onboarding_quiz_attempts 
       (user_id, module, step_number, question, user_answer, is_correct, feedback, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [user_id, module, step_number, step.checkpoint_question, user_answer, 
       validation.is_correct, validation.feedback, attemptNumber]
    );
    
    // Allow up to 3 attempts
    const canProceed = validation.is_correct || attemptNumber >= 3;
    
    return res.json({
      is_correct: validation.is_correct,
      feedback: validation.feedback,
      can_proceed: canProceed,
      attempts: attemptNumber,
      max_attempts: 3
    });
    
  } catch (error) {
    console.error('Error validating answer:', error);
    return res.status(500).json({ error: 'Failed to validate answer' });
  }
});
```

**Prompt for Quiz Validation:**
```javascript
// server/lib/prompt.js - Add validation prompt

function buildQuizValidationPrompt(question, userAnswer, chunks) {
  const context = chunks.map(c => c.text).join('\n\n');
  
  return `You are grading a new warehouse operator's answer to a training checkpoint question.

QUESTION:
${question}

USER'S ANSWER:
${userAnswer}

REFERENCE MATERIAL (SOPs):
${context}

GRADING CRITERIA:
- The answer doesn't need to be word-for-word perfect
- Accept paraphrased answers if they demonstrate understanding
- Key points must be present (safety-critical steps can't be skipped)
- Minor errors in terminology are OK if concept is correct

OUTPUT FORMAT (JSON):
{
  "is_correct": true/false,
  "feedback": "Brief explanation. If correct: 'Great job! You got it.' If incorrect: 'Not quite. The key point you missed is...' Keep it encouraging."
}

EXAMPLES:

Question: "What do you do if you encounter a short pick?"
User Answer: "Mark it as short and let my supervisor know"
Correct: YES (has key steps: mark short + notify supervisor)
Feedback: "Great job! You've got the main steps correct."

Question: "What are the main steps in batch picking?"
User Answer: "Get items from shelves"
Correct: NO (too vague, missing critical steps like scanning, confirming quantities)
Feedback: "Not quite. You're on the right track, but batch picking involves several specific steps: selecting the batch, scanning items, confirming quantities, and closing the batch. Try reviewing the workflow again."

NOW: Grade the user's answer above.`;
}

module.exports = {
  buildPrompt,
  buildOnboardingPrompt,
  buildQuizValidationPrompt // new
};
```

**Frontend Changes:**
```jsx
// client/src/components/OnboardingMode.jsx - Update checkpoint section

const [userAnswer, setUserAnswer] = useState('');
const [quizResult, setQuizResult] = useState(null);
const [submitting, setSubmitting] = useState(false);

// Replace checkbox with answer input
{showCheckpoint && !quizResult && (
  <div className="checkpoint">
    <h3>Knowledge Check:</h3>
    <p>{step?.checkpoint_question}</p>
    
    <textarea
      value={userAnswer}
      onChange={(e) => setUserAnswer(e.target.value)}
      placeholder="Type your answer here..."
      rows="4"
      className="answer-input"
    />
    
    <button 
      onClick={submitAnswer}
      disabled={!userAnswer.trim() || submitting}
      className="submit-answer-btn"
    >
      {submitting ? 'Checking...' : 'Submit Answer'}
    </button>
  </div>
)}

// Show feedback
{quizResult && (
  <div className={`quiz-feedback ${quizResult.is_correct ? 'correct' : 'incorrect'}`}>
    <div className="feedback-icon">
      {quizResult.is_correct ? '✅' : '❌'}
    </div>
    <p className="feedback-text">{quizResult.feedback}</p>
    
    {quizResult.can_proceed ? (
      <button 
        onClick={completeStep}
        className="continue-btn"
      >
        Continue to Next Step →
      </button>
    ) : (
      <>
        <p className="retry-hint">
          Attempts: {quizResult.attempts}/3
        </p>
        <button 
          onClick={() => {
            setQuizResult(null);
            setUserAnswer('');
          }}
          className="retry-btn"
        >
          Try Again
        </button>
      </>
    )}
  </div>
)}

// Submit answer function
const submitAnswer = async () => {
  setSubmitting(true);
  
  try {
    const res = await fetch('/onboarding/validate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        module: selectedModule,
        step_number: step.step_number,
        user_answer: userAnswer
      })
    });
    
    const result = await res.json();
    setQuizResult(result);
    
  } catch (error) {
    console.error('Failed to submit answer:', error);
    alert('Failed to check answer. Please try again.');
  } finally {
    setSubmitting(false);
  }
};
```

**CSS for Quiz:**
```css
.answer-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  margin: 1rem 0;
  resize: vertical;
}

.answer-input:focus {
  outline: none;
  border-color: #2196F3;
}

.submit-answer-btn {
  width: 100%;
  padding: 1rem;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1.1rem;
  cursor: pointer;
}

.submit-answer-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.quiz-feedback {
  padding: 1.5rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.quiz-feedback.correct {
  background: #e8f5e9;
  border: 2px solid #4CAF50;
}

.quiz-feedback.incorrect {
  background: #ffebee;
  border: 2px solid #f44336;
}

.feedback-icon {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 1rem;
}

.feedback-text {
  font-size: 1.1rem;
  line-height: 1.6;
  margin: 1rem 0;
}

.retry-hint {
  color: #666;
  font-style: italic;
  margin: 0.5rem 0;
}

.retry-btn {
  width: 100%;
  padding: 1rem;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1.1rem;
  cursor: pointer;
  margin-top: 1rem;
}
```

**Testing:**
1. Complete a step and reach checkpoint
2. Submit wrong answer → see feedback, retry
3. Submit correct answer → proceed to next step
4. Fail 3 times → still allowed to proceed (with warning)

**Success Metrics:**
- First-attempt correct rate >60%
- Average attempts per question <1.5
- Retention improves (operators remember procedures longer)

---

### **Feature 3: Completion Certificates** ⭐⭐⭐
**Impact:** Medium  
**Effort:** 2 hours  
**Build Priority:** #3 (build if compliance/HR requires documentation)

**Why This Matters:**
- Compliance documentation (prove training completed)
- Employee motivation (tangible achievement)
- HR records (certification system)
- Professional development tracking

**User Story:**
> As a warehouse operator, I want to receive a certificate when I complete onboarding, so I have proof of my training for my records and performance reviews.

---

#### Implementation Plan

**Backend API:**
```javascript
// server/routes/onboarding.js - Modify complete-step endpoint

// When user completes final step:
if (completed >= total) {
  // Mark as completed
  await db.query(
    `UPDATE onboarding_progress
     SET completed_at = NOW()
     WHERE user_id = $1 AND module = $2
     RETURNING *`,
    [user_id, module]
  );
  
  // Generate certificate
  const certificateUrl = await generateCertificate({
    user_id,
    module,
    completed_at: new Date(),
    total_steps: total
  });
  
  return res.json({
    completed: true,
    message: `Congratulations! 🎉 You've completed ${module} module onboarding!`,
    certificate_url: certificateUrl,
    completed_steps: completed,
    total_steps: total
  });
}
```

**Certificate Generator:**
```javascript
// server/lib/certificates.js

const { Document, Paragraph, TextRun, AlignmentType, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');

async function generateCertificate({ user_id, module, completed_at, total_steps }) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header
        new Paragraph({
          text: "Certificate of Completion",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        
        // Border decoration
        new Paragraph({
          text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        
        // Body text
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "This certifies that",
              size: 24
            })
          ]
        }),
        
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: user_id,
              size: 32,
              bold: true,
              color: "2E7D32"
            })
          ]
        }),
        
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "has successfully completed",
              size: 24
            })
          ]
        }),
        
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: `${module} Module Onboarding`,
              size: 32,
              bold: true,
              color: "1976D2"
            })
          ]
        }),
        
        // Details
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [
            new TextRun({
              text: `Completion Date: ${completed_at.toLocaleDateString()}`,
              size: 20
            })
          ]
        }),
        
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: `Training Steps Completed: ${total_steps}`,
              size: 20
            })
          ]
        }),
        
        // Footer
        new Paragraph({
          text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 }
        }),
        
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Walter Surface Technologies - WMS Training",
              size: 20,
              italics: true
            })
          ]
        })
      ]
    }]
  });
  
  // Save to file
  const filename = `${user_id}_${module}_Certificate_${Date.now()}.docx`;
  const filepath = path.join(__dirname, '../../certificates', filename);
  
  // Ensure certificates directory exists
  const certDir = path.join(__dirname, '../../certificates');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filepath, buffer);
  
  return `/certificates/${filename}`;
}

module.exports = { generateCertificate };
```

**Serve Certificates:**
```javascript
// server/index.js - Add static file serving

const express = require('express');
const path = require('path');

app.use('/certificates', express.static(path.join(__dirname, '../certificates')));
```

**Frontend Display:**
```jsx
// In OnboardingMode.jsx - After completion

{completed && (
  <div className="completion-celebration">
    <h2>🎉 Congratulations!</h2>
    <p>You've completed {selectedModule} Module Onboarding!</p>
    
    {completionData.certificate_url && (
      <a 
        href={completionData.certificate_url}
        download
        className="download-certificate-btn"
      >
        📜 Download Certificate
      </a>
    )}
    
    <button onClick={onExit} className="return-btn">
      Return to Chat
    </button>
  </div>
)}
```

**Testing:**
1. Complete all steps in a module
2. Verify certificate downloads
3. Open certificate → verify all details correct
4. Check certificate is professional-looking

**Success Metrics:**
- 90%+ of completers download certificate
- Certificates used in performance reviews
- HR uses certificates for compliance tracking

---

### **Feature 4: Spaced Repetition Reminders** ⭐⭐
**Impact:** Medium  
**Effort:** 4 hours  
**Build Priority:** #4 (build if retention is a problem)

**Why This Matters:**
- Improves long-term retention (learning science)
- Prevents "learned it, forgot it" syndrome
- Reinforces critical safety procedures
- Identifies operators who need refreshers

**User Story:**
> As a warehouse operator, I want to be reminded to review procedures I learned 1 week and 1 month ago, so I don't forget critical steps.

---

#### Implementation Plan

**Database Schema:**
```sql
-- Review schedule
CREATE TABLE onboarding_reviews (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  module TEXT NOT NULL,
  step_number INT NOT NULL,
  review_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_due ON onboarding_reviews(user_id, review_date, completed);

-- Function to schedule reviews
CREATE OR REPLACE FUNCTION schedule_reviews(p_user_id TEXT, p_module TEXT)
RETURNS VOID AS $$
BEGIN
  -- Schedule 1-week review
  INSERT INTO onboarding_reviews (user_id, module, step_number, review_date)
  SELECT 
    p_user_id,
    p_module,
    step_number,
    CURRENT_DATE + INTERVAL '7 days'
  FROM onboarding_curriculum
  WHERE module = p_module;
  
  -- Schedule 1-month review
  INSERT INTO onboarding_reviews (user_id, module, step_number, review_date)
  SELECT 
    p_user_id,
    p_module,
    step_number,
    CURRENT_DATE + INTERVAL '30 days'
  FROM onboarding_curriculum
  WHERE module = p_module;
END;
$$ LANGUAGE plpgsql;
```

**Backend API:**
```javascript
// server/routes/onboarding.js - Add review endpoints

/**
 * GET /onboarding/reviews/due/:user_id
 * Get reviews due for a user
 */
router.get('/reviews/due/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  try {
    const result = await db.query(
      `SELECT 
        r.id,
        r.module,
        r.step_number,
        c.step_title,
        r.review_date
       FROM onboarding_reviews r
       JOIN onboarding_curriculum c ON c.module = r.module AND c.step_number = r.step_number
       WHERE r.user_id = $1 
         AND r.review_date <= CURRENT_DATE
         AND r.completed = false
       ORDER BY r.review_date ASC`,
      [user_id]
    );
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting due reviews:', error);
    return res.status(500).json({ error: 'Failed to get reviews' });
  }
});

/**
 * POST /onboarding/reviews/complete
 * Mark review as complete
 */
router.post('/reviews/complete', async (req, res) => {
  const { review_id } = req.body;
  
  try {
    await db.query(
      `UPDATE onboarding_reviews
       SET completed = true, completed_at = NOW()
       WHERE id = $1`,
      [review_id]
    );
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error completing review:', error);
    return res.status(500).json({ error: 'Failed to complete review' });
  }
});

// Trigger review scheduling when onboarding completes
// In complete-step endpoint, after marking completed:
if (completed >= total) {
  // ... existing code ...
  
  // Schedule reviews
  await db.query('SELECT schedule_reviews($1, $2)', [user_id, module]);
}
```

**Frontend - Review Notification:**
```jsx
// client/src/components/ReviewNotification.jsx

export default function ReviewNotification({ userId }) {
  const [dueReviews, setDueReviews] = useState([]);
  const [showReviews, setShowReviews] = useState(false);
  
  useEffect(() => {
    loadDueReviews();
    // Check daily
    const interval = setInterval(loadDueReviews, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);
  
  const loadDueReviews = async () => {
    const res = await fetch(`/onboarding/reviews/due/${userId}`);
    const data = await res.json();
    setDueReviews(data);
  };
  
  if (dueReviews.length === 0) return null;
  
  return (
    <div className="review-notification">
      <div className="review-badge" onClick={() => setShowReviews(true)}>
        📚 {dueReviews.length} review{dueReviews.length > 1 ? 's' : ''} due
      </div>
      
      {showReviews && (
        <div className="review-modal">
          <h3>Time to Review!</h3>
          <p>These topics are ready for review to reinforce your learning:</p>
          <ul>
            {dueReviews.map(review => (
              <li key={review.id}>
                <strong>{review.module}:</strong> {review.step_title}
                <button onClick={() => startReview(review)}>
                  Review Now
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => setShowReviews(false)}>
            Remind Me Later
          </button>
        </div>
      )}
    </div>
  );
}
```

**Testing:**
1. Complete onboarding
2. Manually set review_date to today in DB
3. Reload app → see notification
4. Click review → go through steps again
5. Mark complete → notification disappears

**Success Metrics:**
- 50%+ of reviews completed within 7 days of due date
- Operators retain procedures longer (measured by error rates)
- Quiz scores improve on reviews vs first attempt

---

## 🎬 Implementation Order

**After v1 ships and you have feedback:**

1. **Week 1-2:** Gather data
   - Get 10+ completions
   - Interview 3-5 operators
   - Track metrics (completion rate, time, questions)

2. **Week 3:** Decide priorities
   - Review this document
   - Match features to actual problems:
     - Supervisors asking "who finished?" → Build dashboard
     - Operators clicking through → Build quiz validation
     - HR needs documentation → Build certificates
     - Retention is poor → Build spaced repetition

3. **Week 4+:** Build highest-impact feature first
   - Start with #1 priority
   - Ship, validate, measure
   - Then move to #2

---

## ⚠️ IMPORTANT REMINDERS

**DO NOT:**
- Build all v2 features at once
- Build features because they sound cool
- Build based on assumptions

**DO:**
- Build one feature at a time
- Validate each feature solves a real problem
- Measure impact before building next feature

**THE TRAP:**
"I'll just build all v2 features now while I'm in the code."

**NO.** That's how you waste 2 weeks building features nobody uses.

**THE RIGHT WAY:**
Ship v1 → Use → Learn → Build one v2 feature → Repeat

---

## 📊 Decision Matrix for v2 Features

| Feature | Build If... | Don't Build If... |
|---------|-------------|-------------------|
| **Supervisor Dashboard** | Supervisors ask "who finished?" weekly | Nobody asks about team progress |
| **Quiz Validation** | Completion rate >90% but operators still ask basic questions | Operators struggle to complete (too hard already) |
| **Certificates** | HR or compliance requests it | Nobody asks for documentation |
| **Spaced Repetition** | Operators forget procedures after 2-4 weeks | Procedures are simple/rarely used |

---

## 🚀 Final Note

**This document exists to GUIDE your decisions, not dictate them.**

After v1 ships, you'll know WAY more about what operators actually need. Use that knowledge to prioritize ruthlessly.

The best product developers ship fast, learn fast, and build what matters.

**Now go ship v1. Come back to this when you have real user data.** 📈

---

**Reminder Set:**
- [ ] v1 is complete and working
- [ ] 10+ operators have used it
- [ ] 2+ weeks of usage data collected
- [ ] Feedback gathered from operators and supervisors
- [ ] Metrics tracked (completion rate, time, questions asked)
- [ ] NOW review this v2 plan and decide what to build next

**Date to Review v2 Plan:** [Set this after v1 ships + 2 weeks]
