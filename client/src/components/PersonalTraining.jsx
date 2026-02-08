import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import './PersonalTraining.css';

export default function PersonalTraining({ authFetch, onStartOnboarding }) {
  const [training, setTraining] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadTraining();
  }, []);

  const loadTraining = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/operator/onboarding');
      if (!res.ok) throw new Error('Failed to load training progress');
      const data = await res.json();
      setTraining(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load training progress:', error);
      showToast('error', 'Failed to load training progress.');
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const completed = training.filter(t => t.status === 'completed').length;
    const active = training.filter(t => t.status === 'active').length;
    const stalled = training.filter(t => t.status === 'stalled').length;
    const total = training.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, active, stalled, total, percent };
  }, [training]);

  if (loading) {
    return (
      <div className="personal-training loading">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading training progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-training">
      <div className="training-header-row">
        <h2>Modules Completed</h2>
        <div className="training-header-actions">
          <button onClick={loadTraining} className="training-btn secondary">Refresh</button>
          <button onClick={onStartOnboarding} className="training-btn primary">Open Onboarding</button>
        </div>
      </div>

      <div className="training-summary-cards">
        <div className="training-summary-card">
          <div className="summary-value">{summary.completed}</div>
          <div className="summary-label">Completed</div>
        </div>
        <div className="training-summary-card">
          <div className="summary-value">{summary.active}</div>
          <div className="summary-label">Active</div>
        </div>
        <div className="training-summary-card">
          <div className="summary-value">{summary.stalled}</div>
          <div className="summary-label">Stalled</div>
        </div>
        <div className="training-summary-card accent">
          <div className="summary-value">{summary.percent}%</div>
          <div className="summary-label">Completion</div>
        </div>
      </div>

      {training.length === 0 ? (
        <div className="training-empty-state">
          <p>No onboarding modules started yet.</p>
          <button onClick={onStartOnboarding} className="training-btn primary">Start Onboarding</button>
        </div>
      ) : (
        <div className="training-table-wrapper">
          <table className="training-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {training.map(row => {
                const totalSteps = Number(row.total_steps || 0);
                const completedCount = Number(row.completed_count || 0);
                const progress = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
                return (
                  <tr key={row.module}>
                    <td>{row.module}</td>
                    <td>
                      <div className="training-progress-bar" role="img" aria-label={`${row.module} progress ${progress}%`}>
                        <div className="training-progress-fill" style={{ width: `${progress}%` }} />
                        <span className="training-progress-text">{completedCount}/{totalSteps}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`training-status ${row.status}`}>{row.status.replace('_', ' ')}</span>
                    </td>
                    <td>{formatDateTime(row.last_activity)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}
