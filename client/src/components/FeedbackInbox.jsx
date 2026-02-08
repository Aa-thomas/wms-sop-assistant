import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import './FeedbackInbox.css';

export default function FeedbackInbox({ authFetch }) {
  const [feedback, setFeedback] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [notesMap, setNotesMap] = useState({});
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([loadFeedback(), loadSummary()]).finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  const loadFeedback = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);

      const res = await authFetch(`/feedback/anonymous?${params.toString()}`);
      const data = await res.json();
      setFeedback(data);

      // Initialize notes map
      const notes = {};
      data.forEach(f => {
        notes[f.id] = f.supervisor_notes || '';
      });
      setNotesMap(notes);
    } catch (error) {
      console.error('Failed to load feedback:', error);
      showToast('error', 'Failed to load feedback.');
    }
  };

  const loadSummary = async () => {
    try {
      const res = await authFetch('/feedback/anonymous/summary');
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const updateFeedback = async (id, updates) => {
    try {
      const res = await authFetch(`/feedback/anonymous/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!res.ok) throw new Error('Update failed');

      const updated = await res.json();
      setFeedback(prev => prev.map(f => f.id === id ? updated : f));
      showToast('success', 'Feedback updated.');
      loadSummary();
    } catch (error) {
      console.error('Failed to update feedback:', error);
      showToast('error', 'Failed to update feedback.');
    }
  };

  const handleNotesChange = (id, value) => {
    setNotesMap(prev => ({ ...prev, [id]: value }));
  };

  const saveNotes = async (id) => {
    await updateFeedback(id, { supervisor_notes: notesMap[id] });
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="no-feedback">Loading feedback...</div>;
  }

  return (
    <div className="feedback-inbox">
      <div className="feedback-inbox-header">
        <div className="feedback-filters">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="actioned">Actioned</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            <option value="complaint">Complaints</option>
            <option value="suggestion">Suggestions</option>
            <option value="feedback">Feedback</option>
          </select>
        </div>

        {summary && (
          <div className="feedback-summary-bar">
            <div className="summary-item new">
              <span className="count">{summary.new_count}</span>
              <span>New</span>
            </div>
            <div className="summary-item high">
              <span className="count">{summary.high_urgency_new}</span>
              <span>High Priority</span>
            </div>
            <div className="summary-item">
              <span className="count">{summary.last_24h}</span>
              <span>Last 24h</span>
            </div>
          </div>
        )}
      </div>

      {feedback.length === 0 ? (
        <div className="no-feedback">
          {statusFilter || typeFilter
            ? 'No feedback matches your filters.'
            : 'No anonymous feedback has been submitted yet.'}
        </div>
      ) : (
        <div className="feedback-list">
          {feedback.map(item => (
            <div
              key={item.id}
              className={`feedback-card urgency-${item.urgency} status-${item.status}`}
            >
              <div className="feedback-card-header">
                <div className="feedback-card-badges">
                  <span className={`feedback-badge type-${item.type}`}>
                    {item.type}
                  </span>
                  <span className="feedback-badge category">
                    {item.category}
                  </span>
                  {item.urgency === 'high' && (
                    <span className="feedback-badge urgency-high">
                      High Priority
                    </span>
                  )}
                  {item.status !== 'new' && (
                    <span className={`feedback-badge status status-${item.status}`}>
                      {item.status}
                    </span>
                  )}
                </div>
                <span className="feedback-card-time">
                  {formatTime(item.created_at)}
                </span>
              </div>

              <div className="feedback-card-message">
                {item.message}
              </div>

              <div className="feedback-card-notes">
                <label htmlFor={`notes-${item.id}`}>Supervisor Notes</label>
                <textarea
                  id={`notes-${item.id}`}
                  value={notesMap[item.id] || ''}
                  onChange={(e) => handleNotesChange(item.id, e.target.value)}
                  placeholder="Add notes about actions taken or follow-up needed..."
                  onBlur={() => {
                    if (notesMap[item.id] !== (item.supervisor_notes || '')) {
                      saveNotes(item.id);
                    }
                  }}
                />
              </div>

              <div className="feedback-card-actions">
                {item.status === 'new' && (
                  <>
                    <button
                      className="feedback-action-btn"
                      onClick={() => updateFeedback(item.id, { status: 'reviewed' })}
                    >
                      Mark Reviewed
                    </button>
                    <button
                      className="feedback-action-btn secondary"
                      onClick={() => updateFeedback(item.id, { status: 'actioned' })}
                    >
                      Mark Actioned
                    </button>
                    <button
                      className="feedback-action-btn dismiss"
                      onClick={() => updateFeedback(item.id, { status: 'dismissed' })}
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {item.status === 'reviewed' && (
                  <>
                    <button
                      className="feedback-action-btn"
                      onClick={() => updateFeedback(item.id, { status: 'actioned' })}
                    >
                      Mark Actioned
                    </button>
                    <button
                      className="feedback-action-btn dismiss"
                      onClick={() => updateFeedback(item.id, { status: 'dismissed' })}
                    >
                      Dismiss
                    </button>
                  </>
                )}
                {(item.status === 'actioned' || item.status === 'dismissed') && (
                  <button
                    className="feedback-action-btn secondary"
                    onClick={() => updateFeedback(item.id, { status: 'new' })}
                  >
                    Reopen
                  </button>
                )}
                {item.reviewed_at && (
                  <span className="feedback-reviewed-info">
                    {item.reviewed_by && `${item.reviewed_by} · `}
                    {formatTime(item.reviewed_at)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
