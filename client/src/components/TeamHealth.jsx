import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import './TeamHealth.css';

export default function TeamHealth({ authFetch }) {
  const [teamStrength, setTeamStrength] = useState(null);
  const [healthData, setHealthData] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [userWeaknesses, setUserWeaknesses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([loadTeamStrength(), loadTeamHealth()]).finally(() => setLoading(false));
  }, []);

  const loadTeamStrength = async () => {
    try {
      const res = await authFetch('/onboarding/supervisor/team-strength');
      const data = await res.json();
      setTeamStrength(data);
    } catch (error) {
      console.error('Failed to load team strength:', error);
      showToast('error', 'Failed to load team strength data.');
    }
  };

  const loadTeamHealth = async () => {
    try {
      const res = await authFetch('/onboarding/supervisor/team-health');
      const data = await res.json();
      setHealthData(data);
    } catch (error) {
      console.error('Failed to load team health:', error);
      showToast('error', 'Failed to load team health data.');
    }
  };

  const openUserDetails = async (user) => {
    setSelectedUser(user);
    setDetailLoading(true);
    setUserDetails(null);
    setUserWeaknesses(null);

    try {
      const [detailsRes, weaknessesRes] = await Promise.all([
        authFetch(`/onboarding/supervisor/user/${encodeURIComponent(user.user_id)}`),
        authFetch(`/onboarding/supervisor/user/${encodeURIComponent(user.user_id)}/weaknesses`)
      ]);
      const [details, weaknesses] = await Promise.all([
        detailsRes.json(),
        weaknessesRes.json()
      ]);
      setUserDetails(details);
      setUserWeaknesses(weaknesses);
    } catch (error) {
      console.error('Failed to load user details:', error);
      showToast('error', 'Failed to load user details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setUserDetails(null);
    setUserWeaknesses(null);
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

  const healthLabel = (status) => {
    switch (status) {
      case 'at_risk': return 'At Risk';
      case 'needs_attention': return 'Needs Attention';
      default: return 'Healthy';
    }
  };

  const weaknessLabel = (type) => {
    switch (type) {
      case 'quiz_failure': return 'Quiz Failure';
      case 'stalled_module': return 'Stalled';
      case 'not_started': return 'Not Started';
      default: return type;
    }
  };

  // Sort: at_risk first, then needs_attention, then healthy
  const sortedHealth = [...healthData].sort((a, b) => {
    const order = { at_risk: 0, needs_attention: 1, healthy: 2 };
    return (order[a.health_status] ?? 3) - (order[b.health_status] ?? 3);
  });

  if (loading) {
    return <div className="no-data">Loading team health data...</div>;
  }

  return (
    <>
      {/* Team Strength Banner */}
      {teamStrength && (
        <>
          <div className="team-strength-banner">
            <div className="strength-card total">
              <div className="strength-number">{teamStrength.total_users || 0}</div>
              <div className="strength-label">Total Users</div>
            </div>
            <div className="strength-card healthy">
              <div className="strength-number">{teamStrength.healthy_count || 0}</div>
              <div className="strength-label">Healthy</div>
            </div>
            <div className="strength-card attention">
              <div className="strength-number">{teamStrength.needs_attention_count || 0}</div>
              <div className="strength-label">Needs Attention</div>
            </div>
            <div className="strength-card at-risk">
              <div className="strength-number">{teamStrength.at_risk_count || 0}</div>
              <div className="strength-label">At Risk</div>
            </div>
          </div>

          {teamStrength.weakest_modules && teamStrength.weakest_modules.length > 0 && (
            <div className="weakest-modules">
              <strong>Weakest modules:</strong>
              {teamStrength.weakest_modules.map((m, i) => (
                <span key={m.module} className="weak-module-tag">
                  {m.module} ({m.completed_users}/{m.total_users})
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* User Health Table */}
      {sortedHealth.length > 0 ? (
        <div className="table-scroll-wrapper">
          <table className="health-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Health</th>
                <th>Modules</th>
                <th>Quiz Rate</th>
                <th>Chat Qs</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedHealth.map(user => (
                <tr key={user.user_id}>
                  <td>{user.username}</td>
                  <td>
                    <span className={`health-indicator ${user.health_status}`}>
                      <span className="health-dot" />
                      {healthLabel(user.health_status)}
                    </span>
                  </td>
                  <td>{user.modules_completed}/{user.modules_started || 0}</td>
                  <td>{user.quiz_correct_rate}%</td>
                  <td>{user.chat_questions_asked}</td>
                  <td>{formatLastActive(user.last_activity)}</td>
                  <td>
                    <button
                      onClick={() => openUserDetails(user)}
                      className="details-btn"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-data">No user health data yet. Users need to start onboarding to appear here.</div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{selectedUser.username}</h2>
            <button className="close-modal" onClick={closeModal}>&times;</button>

            <span className={`health-indicator ${selectedUser.health_status}`}>
              <span className="health-dot" />
              {healthLabel(selectedUser.health_status)}
            </span>

            {detailLoading ? (
              <div className="detail-loading">Loading details...</div>
            ) : (
              <>
                {/* Onboarding Progress */}
                {userDetails && userDetails.length > 0 && (
                  <>
                    <h3 style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)' }}>
                      Onboarding Progress
                    </h3>
                    {userDetails.map(detail => (
                      <div key={detail.module} className="user-detail-card">
                        <h3>{detail.module}</h3>
                        <p>
                          <strong>Progress:</strong> {detail.completed_count}/{detail.total_steps} steps
                        </p>
                        {!detail.completed_at && detail.current_step_title && (
                          <p><strong>Current Step:</strong> {detail.current_step_title}</p>
                        )}
                        {detail.completed_at && (
                          <p><strong>Completed:</strong> {new Date(detail.completed_at).toLocaleDateString()}</p>
                        )}
                        <p><strong>Last Activity:</strong> {new Date(detail.last_activity).toLocaleString()}</p>
                      </div>
                    ))}
                  </>
                )}

                {/* Knowledge Weaknesses */}
                <div className="weakness-section">
                  <h3>Knowledge Weaknesses</h3>
                  {userWeaknesses && userWeaknesses.length > 0 ? (
                    userWeaknesses.map((w, i) => (
                      <div key={i} className={`weakness-item ${w.weakness_type}`}>
                        <div className="weakness-type-badge">{weaknessLabel(w.weakness_type)}</div>
                        <div className="weakness-detail">
                          <strong>{w.module}</strong>
                          {w.step_number && ` - Step ${w.step_number}`}
                        </div>
                        {w.question && (
                          <div className="weakness-detail">"{w.question}"</div>
                        )}
                        {w.weakness_type === 'quiz_failure' && (
                          <div className="weakness-meta">
                            {w.failure_count} failed attempt{w.failure_count > 1 ? 's' : ''}
                            {w.eventually_correct ? ' (eventually got it right)' : ' (never got it right)'}
                          </div>
                        )}
                        {w.detail && (
                          <div className="weakness-meta">{w.detail}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="no-weaknesses">No weaknesses identified</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
