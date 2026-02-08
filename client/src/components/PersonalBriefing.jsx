import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { SkeletonLine } from './Skeleton';
import './PersonalBriefing.css';

export default function PersonalBriefing({ authFetch, onNavigateTab }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/operator/briefing');
      const data = await res.json();
      setBriefing(data);
    } catch (error) {
      console.error('Failed to load briefing:', error);
      showToast('error', 'Failed to load your briefing.');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
      case 'healthy': return '✓ Healthy';
      case 'needs_attention': return '⚠ Needs Focus';
      case 'at_risk': return '⚠ At Risk';
      default: return 'Getting Started';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      default: return '🟢';
    }
  };

  if (loading) {
    return (
      <div className="personal-briefing">
        <div className="briefing-header">
          <div className="greeting-section">
            <h2>{getGreeting()}</h2>
            <div className="briefing-date">{formatDate()}</div>
          </div>
          <SkeletonLine style={{ height: '2rem', width: '5.5rem', borderRadius: 'var(--radius-full)' }} />
        </div>

        <div className="metrics-cards">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="metric-card skeleton-metric-card">
              <SkeletonLine style={{ height: '1.5rem', width: '3rem', margin: '0 auto' }} />
              <SkeletonLine style={{ height: '0.7rem', width: '5rem', margin: '0 auto' }} />
            </div>
          ))}
        </div>

        <div className="briefing-section">
          <SkeletonLine style={{ height: '1rem', width: '8rem' }} />
          <SkeletonLine style={{ height: '0.9rem', width: '100%', marginTop: 'var(--space-3)' }} />
          <SkeletonLine style={{ height: '0.9rem', width: '90%', marginTop: 'var(--space-2)' }} />
          <SkeletonLine style={{ height: '0.9rem', width: '75%', marginTop: 'var(--space-2)' }} />
        </div>

        <div className="briefing-section">
          <SkeletonLine style={{ height: '1rem', width: '7rem' }} />
          {[1, 2].map(i => (
            <div key={i} className="skeleton-tip" style={{ marginTop: 'var(--space-3)' }}>
              <SkeletonLine style={{ height: '0.9rem', width: '40%' }} />
              <SkeletonLine style={{ height: '0.85rem', width: '85%', marginTop: 'var(--space-2)' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="personal-briefing">
        <div className="briefing-header">
          <h2>{getGreeting()}</h2>
          <div className="briefing-date">{formatDate()}</div>
        </div>
        <div className="empty-state">
          <p>Unable to load briefing. Please try again.</p>
          <button onClick={loadBriefing} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  const { metrics, insights, user } = briefing;

  return (
    <div className="personal-briefing">
      <div className="briefing-header">
        <div className="greeting-section">
          <h2>{getGreeting()}, {user?.username || 'there'}!</h2>
          <div className="briefing-date">{formatDate()}</div>
        </div>
        <button onClick={loadBriefing} className="refresh-btn">↻ Refresh</button>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-cards">
        <div className={`metric-card health ${getHealthColor(metrics.health_status)}`}>
          <div className="metric-value">{getHealthLabel(metrics.health_status)}</div>
          <div className="metric-label">Your Status</div>
        </div>
        <div className="metric-card" onClick={() => onNavigateTab?.('training')}>
          <div className="metric-value">
            {metrics.modules_completed}/{metrics.modules_total || metrics.modules_completed + metrics.modules_active + metrics.modules_stalled}
          </div>
          <div className="metric-label">Modules Completed</div>
          {metrics.modules_active > 0 && (
            <div className="metric-sub">{metrics.modules_active} in progress</div>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-value">{metrics.quiz_correct_rate}%</div>
          <div className="metric-label">Quiz Score</div>
        </div>
        <div className="metric-card" onClick={() => onNavigateTab?.('errors')}>
          <div className="metric-value">{metrics.pick_errors_7d}</div>
          <div className="metric-label">Errors This Week</div>
          {metrics.pick_errors_total > 0 && (
            <div className="metric-sub">{metrics.pick_errors_total} total (90d)</div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {insights?.summary && (
        <div className="briefing-section summary-section">
          <h3>📊 Your Summary</h3>
          <p>{insights.summary}</p>
        </div>
      )}

      {/* Tips */}
      {insights?.tips && insights.tips.length > 0 && (
        <div className="briefing-section tips-section">
          <h3>💡 Tips for Today</h3>
          <div className="tips-list">
            {insights.tips.map((tip, i) => (
              <div key={i} className={`tip-card priority-${tip.priority}`}>
                <div className="tip-header">
                  <span className="tip-icon">{getPriorityIcon(tip.priority)}</span>
                  <span className="tip-title">{tip.title}</span>
                </div>
                <p className="tip-description">{tip.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encouragement */}
      {insights?.encouragement && (
        <div className="briefing-section encouragement-section">
          <h3>🎯 Keep Going!</h3>
          <p>{insights.encouragement}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="briefing-section quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          {metrics.modules_active > 0 && (
            <button onClick={() => onNavigateTab?.('training')} className="action-btn primary">
              Continue Training
            </button>
          )}
          <button onClick={() => onNavigateTab?.('health')} className="action-btn">
            View My Health
          </button>
          {metrics.pick_errors_total > 0 && (
            <button onClick={() => onNavigateTab?.('errors')} className="action-btn">
              Review Errors
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
