import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import './PersonalHealth.css';

export default function PersonalHealth({ authFetch }) {
  const [health, setHealth] = useState(null);
  const [weaknesses, setWeaknesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [healthRes, weaknessRes] = await Promise.all([
        authFetch('/operator/health'),
        authFetch('/operator/weaknesses')
      ]);
      const [healthData, weaknessData] = await Promise.all([
        healthRes.json(),
        weaknessRes.json()
      ]);
      setHealth(healthData);
      setWeaknesses(weaknessData);
    } catch (error) {
      console.error('Failed to load health data:', error);
      showToast('error', 'Failed to load health data.');
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'healthy';
      case 'needs_attention': return 'attention';
      case 'at_risk': return 'at-risk';
      default: return 'unknown';
    }
  };

  const getHealthLabel = (status) => {
    switch (status) {
      case 'healthy': return 'Healthy';
      case 'needs_attention': return 'Needs Attention';
      case 'at_risk': return 'At Risk';
      default: return 'Getting Started';
    }
  };

  const getHealthDescription = (status) => {
    switch (status) {
      case 'healthy':
        return "You're doing great! Keep up the excellent work.";
      case 'needs_attention':
        return "You have some areas that could use a little focus. Check the suggestions below.";
      case 'at_risk':
        return "There are some concerns with your progress. Let's work on getting back on track.";
      default:
        return "Welcome! Start your training to build your health score.";
    }
  };

  const formatLastActive = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  const getWeaknessLabel = (type) => {
    switch (type) {
      case 'quiz_failure': return 'Quiz Struggle';
      case 'stalled_module': return 'Stalled';
      case 'not_started': return 'Not Started';
      default: return type;
    }
  };

  const getWeaknessIcon = (type) => {
    switch (type) {
      case 'quiz_failure': return '❓';
      case 'stalled_module': return '⏸️';
      case 'not_started': return '📚';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="personal-health loading">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your health data...</p>
        </div>
      </div>
    );
  }

  const quizFailures = weaknesses.filter(w => w.weakness_type === 'quiz_failure');
  const stalledModules = weaknesses.filter(w => w.weakness_type === 'stalled_module');
  const notStarted = weaknesses.filter(w => w.weakness_type === 'not_started');

  return (
    <div className="personal-health">
      {/* Health Status Banner */}
      <div className={`health-banner ${getHealthColor(health?.health_status)}`}>
        <div className="health-status-icon">
          {health?.health_status === 'healthy' && '✓'}
          {health?.health_status === 'needs_attention' && '⚠'}
          {health?.health_status === 'at_risk' && '⚠'}
          {!health?.health_status && '👋'}
        </div>
        <div className="health-status-text">
          <h2>{getHealthLabel(health?.health_status)}</h2>
          <p>{getHealthDescription(health?.health_status)}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="health-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{health?.modules_completed || 0}</div>
          <div className="stat-label">Modules Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.modules_active || 0}</div>
          <div className="stat-label">In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.modules_stalled || 0}</div>
          <div className="stat-label">Stalled</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.quiz_correct_rate || 0}%</div>
          <div className="stat-label">Quiz Success Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.quiz_avg_attempts || 0}</div>
          <div className="stat-label">Avg Quiz Attempts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.chat_questions_asked || 0}</div>
          <div className="stat-label">Questions Asked</div>
        </div>
      </div>

      {/* Last Activity */}
      <div className="activity-info">
        <span className="activity-label">Last active:</span>
        <span className="activity-value">{formatLastActive(health?.last_activity)}</span>
      </div>

      {/* Areas for Improvement */}
      {(quizFailures.length > 0 || stalledModules.length > 0) && (
        <div className="improvement-section">
          <h3>📈 Areas for Improvement</h3>
          
          {quizFailures.length > 0 && (
            <div className="weakness-group">
              <h4>Quiz Topics to Review</h4>
              <div className="weakness-list">
                {quizFailures.map((w, i) => (
                  <div key={i} className="weakness-item quiz-failure">
                    <span className="weakness-icon">{getWeaknessIcon(w.weakness_type)}</span>
                    <div className="weakness-details">
                      <span className="weakness-module">{w.module}</span>
                      <span className="weakness-info">Step {w.step_number}: "{w.question?.substring(0, 50)}..."</span>
                    </div>
                    {w.eventually_correct && (
                      <span className="eventually-correct">✓ Eventually passed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stalledModules.length > 0 && (
            <div className="weakness-group">
              <h4>Modules to Resume</h4>
              <div className="weakness-list">
                {stalledModules.map((w, i) => (
                  <div key={i} className="weakness-item stalled">
                    <span className="weakness-icon">{getWeaknessIcon(w.weakness_type)}</span>
                    <div className="weakness-details">
                      <span className="weakness-module">{w.module}</span>
                      <span className="weakness-info">{w.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Not Started Modules */}
      {notStarted.length > 0 && (
        <div className="not-started-section">
          <h3>📚 Available Modules</h3>
          <p className="section-description">These modules are available for you to start:</p>
          <div className="module-tags">
            {notStarted.map((w, i) => (
              <span key={i} className="module-tag">{w.module}</span>
            ))}
          </div>
        </div>
      )}

      {/* All Good Message */}
      {quizFailures.length === 0 && stalledModules.length === 0 && health?.modules_started > 0 && (
        <div className="all-good-section">
          <span className="all-good-icon">🎉</span>
          <p>No areas of concern! You're doing great.</p>
        </div>
      )}
    </div>
  );
}
