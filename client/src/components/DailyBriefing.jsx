import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { SkeletonLine } from './Skeleton';
import './DailyBriefing.css';

export default function DailyBriefing({ authFetch, onNavigateTab }) {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadBriefing();
  }, []);

  const loadBriefing = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await authFetch('/briefing/daily');
      if (!res.ok) {
        throw new Error('Failed to fetch briefing');
      }
      const data = await res.json();
      setBriefing(data);
    } catch (error) {
      console.error('Failed to load briefing:', error);
      showToast('error', 'Failed to load daily briefing.');
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const handlePriorityClick = (tab) => {
    if (onNavigateTab && tab) {
      onNavigateTab(tab);
    }
  };

  if (loading) {
    return (
      <div className="daily-briefing briefing-loading-skeleton">
        <div className="briefing-header">
          <div className="briefing-greeting">
            <SkeletonLine style={{ height: '1.8rem', width: '16rem' }} />
            <SkeletonLine style={{ height: '0.9rem', width: '14rem' }} />
          </div>
          <SkeletonLine style={{ height: '2rem', width: '6.5rem', borderRadius: 'var(--radius)' }} />
        </div>

        <div className="briefing-metrics">
          <div className="briefing-skeleton-card">
            <SkeletonLine style={{ height: '2rem', width: '3rem' }} />
            <SkeletonLine style={{ height: '0.85rem', width: '7rem' }} />
            <SkeletonLine style={{ height: '0.8rem', width: '6rem' }} />
          </div>
          <div className="briefing-skeleton-card">
            <SkeletonLine style={{ height: '2rem', width: '3rem' }} />
            <SkeletonLine style={{ height: '0.85rem', width: '7rem' }} />
            <SkeletonLine style={{ height: '0.8rem', width: '5rem' }} />
          </div>
          <div className="briefing-skeleton-card">
            <SkeletonLine style={{ height: '2rem', width: '3rem' }} />
            <SkeletonLine style={{ height: '0.85rem', width: '8.5rem' }} />
            <SkeletonLine style={{ height: '0.8rem', width: '5.5rem' }} />
          </div>
          <div className="briefing-skeleton-card">
            <SkeletonLine style={{ height: '2rem', width: '3rem' }} />
            <SkeletonLine style={{ height: '0.85rem', width: '7.5rem' }} />
            <SkeletonLine style={{ height: '0.8rem', width: '6rem' }} />
          </div>
          <div className="briefing-skeleton-card">
            <SkeletonLine style={{ height: '2rem', width: '3rem' }} />
            <SkeletonLine style={{ height: '0.85rem', width: '6.5rem' }} />
            <SkeletonLine style={{ height: '0.8rem', width: '5.5rem' }} />
          </div>
        </div>

        <div className="briefing-skeleton-block">
          <SkeletonLine style={{ height: '1rem', width: '9rem' }} />
          <SkeletonLine style={{ height: '0.95rem', width: '100%' }} />
          <SkeletonLine style={{ height: '0.95rem', width: '92%' }} />
          <SkeletonLine style={{ height: '0.95rem', width: '84%' }} />
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="briefing-empty">
        Unable to load briefing. Please try again.
      </div>
    );
  }

  const { metrics, insights, urgentFeedback } = briefing;

  return (
    <div className="daily-briefing">
      <div className="briefing-header">
        <div className="briefing-greeting">
          <h2>{getGreeting()}</h2>
          <span className="date">{formatDate()}</span>
        </div>
        <button
          className="briefing-refresh"
          onClick={() => loadBriefing(true)}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Key Metrics */}
      <div className="briefing-metrics">
        <div
          className={`metric-card ${metrics.teamHealth?.at_risk_count > 0 ? 'alert' : ''}`}
          onClick={() => onNavigateTab?.('health')}
        >
          <span className="metric-value">
            {metrics.teamHealth?.at_risk_count || 0}
          </span>
          <span className="metric-label">At-Risk Users</span>
          {metrics.teamHealth?.needs_attention_count > 0 && (
            <span className="metric-detail">
              +{metrics.teamHealth.needs_attention_count} need attention
            </span>
          )}
        </div>

        <div
          className={`metric-card ${metrics.onboarding?.stalled_modules > 0 ? 'warning' : ''}`}
          onClick={() => onNavigateTab?.('onboarding')}
        >
          <span className="metric-value">
            {metrics.onboarding?.stalled_modules || 0}
          </span>
          <span className="metric-label">Stalled Modules</span>
          <span className="metric-detail">
            {metrics.onboarding?.active_modules || 0} active
          </span>
        </div>

        <div
          className={`metric-card ${metrics.knowledgeGaps?.high_severity_gaps > 0 ? 'alert' : ''}`}
          onClick={() => onNavigateTab?.('gaps')}
        >
          <span className="metric-value">
            {metrics.knowledgeGaps?.open_gaps || 0}
          </span>
          <span className="metric-label">Open Knowledge Gaps</span>
          {metrics.knowledgeGaps?.high_severity_gaps > 0 && (
            <span className="metric-detail">
              {metrics.knowledgeGaps.high_severity_gaps} high severity
            </span>
          )}
        </div>

        <div
          className="metric-card"
          onClick={() => onNavigateTab?.('errors')}
        >
          <span className="metric-value">
            {metrics.pickErrors?.total_errors_7d || 0}
          </span>
          <span className="metric-label">Pick Errors (7d)</span>
          {metrics.pickErrors?.users_with_errors > 0 && (
            <span className="metric-detail">
              {metrics.pickErrors.users_with_errors} users affected
            </span>
          )}
        </div>

        <div
          className={`metric-card ${metrics.feedback?.high_urgency_new > 0 ? 'alert' : ''}`}
          onClick={() => onNavigateTab?.('feedback')}
        >
          <span className="metric-value">
            {metrics.feedback?.new_count || 0}
          </span>
          <span className="metric-label">New Feedback</span>
          {metrics.feedback?.high_urgency_new > 0 && (
            <span className="metric-detail">
              {metrics.feedback.high_urgency_new} high priority
            </span>
          )}
        </div>
      </div>

      {/* Urgent Feedback Alert */}
      {urgentFeedback && urgentFeedback.length > 0 && (
        <div className="briefing-urgent-feedback" onClick={() => onNavigateTab?.('feedback')}>
          <h3>⚠️ Urgent Feedback Requiring Attention</h3>
          {urgentFeedback.slice(0, 3).map((f, i) => (
            <div key={i} className="urgent-feedback-item">
              <div className="urgent-feedback-meta">
                {f.type} · {f.category} · {f.urgency} urgency
              </div>
              <div className="urgent-feedback-message">
                {f.message.length > 150 ? f.message.substring(0, 150) + '...' : f.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {insights?.summary && (
        <div className="briefing-summary">
          <h3>Today's Overview</h3>
          <p className="summary-text">{insights.summary}</p>
        </div>
      )}

      {/* Priority Items */}
      {insights?.priorities && insights.priorities.length > 0 && (
        <div className="briefing-priorities">
          <h3>Priority Items</h3>
          <div className="priority-list">
            {insights.priorities.map((item, i) => (
              <div
                key={i}
                className="priority-item"
                onClick={() => handlePriorityClick(item.tab)}
              >
                <div className={`priority-indicator ${item.urgency}`} />
                <div className="priority-content">
                  <div className="priority-title">{item.title}</div>
                  <div className="priority-description">{item.description}</div>
                  {item.tab && (
                    <span className="priority-tab">
                      View in {item.tab.charAt(0).toUpperCase() + item.tab.slice(1)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Actions */}
      {insights?.suggestions && insights.suggestions.length > 0 && (
        <div className="briefing-suggestions">
          <h3>Suggested Actions</h3>
          <div className="suggestion-list">
            {insights.suggestions.map((suggestion, i) => (
              <div key={i} className="suggestion-item">
                <span className="suggestion-icon">💡</span>
                <div className="suggestion-content">
                  <div className="suggestion-action">{suggestion.action}</div>
                  <div className="suggestion-reason">{suggestion.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
