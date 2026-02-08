import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../contexts/ToastContext';
import './PickErrors.css';

export default function PickErrors({ authFetch }) {
  const [errors, setErrors] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSummary, setUserSummary] = useState(null);
  const [aiTips, setAiTips] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    user_id: '',
    pps_number: '',
    shipment_number: '',
    item: '',
    quantity_variance: '',
    notes: ''
  });

  useEffect(() => {
    Promise.all([loadErrors(), loadUsers()]).finally(() => setLoading(false));
  }, []);

  const loadErrors = async (userId = null) => {
    try {
      const url = userId ? `/pick-errors?user_id=${encodeURIComponent(userId)}` : '/pick-errors';
      const res = await authFetch(url);
      const data = await res.json();
      setErrors(data);
    } catch (error) {
      console.error('Failed to load pick errors:', error);
      showToast('error', 'Failed to load pick errors.');
    }
  };

  const loadUsers = async () => {
    try {
      const res = await authFetch('/onboarding/supervisor/team-health');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadUserSummary = async (userId) => {
    try {
      const res = await authFetch(`/pick-errors/user/${encodeURIComponent(userId)}/summary`);
      const data = await res.json();
      setUserSummary(data);
    } catch (error) {
      console.error('Failed to load user summary:', error);
      showToast('error', 'Failed to load error summary.');
    }
  };

  const handleUserFilter = async (userId) => {
    setSelectedUserId(userId);
    setAiTips(null);
    setUserSummary(null);

    if (userId) {
      await Promise.all([loadErrors(userId), loadUserSummary(userId)]);
    } else {
      await loadErrors();
    }
  };

  const handleAnalyze = async () => {
    if (!selectedUserId) return;
    setAnalyzing(true);
    setAiTips(null);

    try {
      const res = await authFetch(`/pick-errors/user/${encodeURIComponent(selectedUserId)}/analyze`, {
        method: 'POST'
      });
      const data = await res.json();
      setAiTips(data);
    } catch (error) {
      console.error('Failed to analyze errors:', error);
      showToast('error', 'Failed to analyze pick errors.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveError = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await authFetch('/pick-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      showToast('success', 'Pick error recorded.');
      setShowLogModal(false);
      setFormData({ user_id: '', pps_number: '', shipment_number: '', item: '', quantity_variance: '', notes: '' });

      // Refresh data
      if (selectedUserId) {
        await Promise.all([loadErrors(selectedUserId), loadUserSummary(selectedUserId)]);
      } else {
        await loadErrors();
      }
    } catch (error) {
      console.error('Failed to save pick error:', error);
      showToast('error', error.message || 'Failed to record pick error.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const rows = errors.map(err => ({
      Date: new Date(err.created_at).toLocaleDateString('en-US'),
      User: err.user_id,
      PPS: err.pps_number,
      Shipment: err.shipment_number,
      Item: err.item,
      Variance: err.quantity_variance,
      Notes: err.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pick Errors');
    const today = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `pick-errors-${today}.xlsx`);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimeSince = (dateStr) => {
    if (!dateStr) return 'N/A';
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  if (loading) {
    return <div className="analyzing-indicator">Loading pick errors...</div>;
  }

  return (
    <div className="pick-errors">
      {/* Header */}
      <div className="pick-errors-header">
        <div className="header-actions">
          <button className="log-error-btn" onClick={() => setShowLogModal(true)}>
            + Log Error
          </button>
          <button className="export-btn" onClick={handleExport} disabled={errors.length === 0}>
            Export
          </button>
          <select
            className="user-filter-select"
            value={selectedUserId}
            onChange={(e) => handleUserFilter(e.target.value)}
          >
            <option value="">All Users</option>
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.username} (ID: {u.user_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards (when user selected) */}
      {selectedUserId && userSummary && (
        <div className="error-summary-cards">
          <div className="error-stat-card">
            <div className="stat-number">{userSummary.total_errors}</div>
            <div className="stat-label">Total Errors</div>
            <div className="stat-detail">Last 90 days</div>
          </div>
          <div className="error-stat-card">
            <div className={`stat-number ${userSummary.avg_variance < 0 ? 'negative' : 'positive'}`}>
              {userSummary.avg_variance > 0 ? '+' : ''}{userSummary.avg_variance}
            </div>
            <div className="stat-label">Avg Variance</div>
            <div className="stat-detail">{userSummary.avg_variance < 0 ? 'Short picks' : 'Over picks'}</div>
          </div>
          <div className="error-stat-card">
            <div className="stat-number" style={{ fontSize: '1.2rem' }}>
              {formatTimeSince(userSummary.last_error)}
            </div>
            <div className="stat-label">Most Recent</div>
          </div>
          <div className="error-stat-card">
            <div className="stat-number" style={{ fontSize: '1.2rem' }}>
              {userSummary.top_items[0] || 'N/A'}
            </div>
            <div className="stat-label">Top Item</div>
            {userSummary.top_items.length > 1 && (
              <div className="stat-detail">+{userSummary.top_items.length - 1} more</div>
            )}
          </div>
        </div>
      )}

      {/* AI Coaching Section (when user selected) */}
      {selectedUserId && (
        <div className="coaching-section">
          <h3>
            AI Coaching Tips
            <button
              className="analyze-btn"
              onClick={handleAnalyze}
              disabled={analyzing || errors.length === 0}
            >
              {analyzing ? 'Analyzing...' : 'Analyze Errors'}
            </button>
          </h3>

          {analyzing && (
            <div className="analyzing-indicator">Analyzing error patterns with AI...</div>
          )}

          {aiTips && !analyzing && (
            <>
              {aiTips.summary && (
                <div className="coaching-summary">{aiTips.summary}</div>
              )}
              {aiTips.tips && aiTips.tips.map((tip, i) => (
                <div key={i} className={`coaching-tip ${tip.priority}`}>
                  <div className="tip-header">
                    <span className="tip-priority">{tip.priority}</span>
                    <span className="tip-title">{tip.title}</span>
                  </div>
                  <div className="tip-description">{tip.description}</div>
                </div>
              ))}
            </>
          )}

          {!aiTips && !analyzing && errors.length > 0 && (
            <div className="coaching-summary" style={{ textAlign: 'center', fontStyle: 'italic' }}>
              Click "Analyze Errors" to get AI-generated coaching tips based on this user's error patterns.
            </div>
          )}
        </div>
      )}

      {/* Error Log Table */}
      {errors.length > 0 ? (
        <div className="table-scroll-wrapper">
          <table className="error-log-table">
            <thead>
              <tr>
                <th>Date</th>
                {!selectedUserId && <th>User</th>}
                <th>PPS</th>
                <th>Shipment</th>
                <th>Item</th>
                <th>Variance</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {errors.map(err => (
                <tr key={err.id}>
                  <td>{formatDate(err.created_at)}</td>
                  {!selectedUserId && <td>{err.user_id}</td>}
                  <td>{err.pps_number}</td>
                  <td>{err.shipment_number}</td>
                  <td>{err.item}</td>
                  <td>
                    <span className={`variance-badge ${err.quantity_variance < 0 ? 'short' : 'over'}`}>
                      {err.quantity_variance > 0 ? '+' : ''}{err.quantity_variance}
                    </span>
                  </td>
                  <td className="error-notes" title={err.notes || ''}>{err.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-errors">
          {selectedUserId
            ? 'No pick errors recorded for this user.'
            : 'No pick errors recorded yet. Click "+ Log Error" to record the first one.'
          }
        </div>
      )}

      {/* Log Error Modal */}
      {showLogModal && (
        <div className="modal-overlay log-error-modal" onClick={() => setShowLogModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Log Pick Error</h2>
            <button className="close-modal" onClick={() => setShowLogModal(false)}>&times;</button>

            <form className="log-error-form" onSubmit={handleSaveError}>
              <div className="form-group">
                <label htmlFor="error-user">Operator</label>
                <select
                  id="error-user"
                  value={formData.user_id}
                  onChange={e => setFormData({ ...formData, user_id: e.target.value })}
                  required
                >
                  <option value="">Select operator...</option>
                  {users.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.username} (ID: {u.user_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="error-pps">PPS Number</label>
                <input
                  id="error-pps"
                  type="text"
                  placeholder="PPS-042"
                  value={formData.pps_number}
                  onChange={e => setFormData({ ...formData, pps_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="error-shipment">Shipment Number</label>
                <input
                  id="error-shipment"
                  type="text"
                  placeholder="SHP-2024-1234"
                  value={formData.shipment_number}
                  onChange={e => setFormData({ ...formData, shipment_number: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="error-item">Item</label>
                <input
                  id="error-item"
                  type="text"
                  placeholder="SKU-ABC-789"
                  value={formData.item}
                  onChange={e => setFormData({ ...formData, item: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="error-variance">Quantity Variance</label>
                <input
                  id="error-variance"
                  type="number"
                  placeholder="-2 (negative = short pick)"
                  value={formData.quantity_variance}
                  onChange={e => setFormData({ ...formData, quantity_variance: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="error-notes">Notes (optional)</label>
                <textarea
                  id="error-notes"
                  placeholder="Additional context..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowLogModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Error'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
