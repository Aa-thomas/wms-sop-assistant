import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { SkeletonSummaryCard, SkeletonTableRow } from './Skeleton';
import DailyBriefing from './DailyBriefing';
import GapAnalysis from './GapAnalysis';
import TeamHealth from './TeamHealth';
import PickErrors from './PickErrors';
import FeedbackInbox from './FeedbackInbox';
import AdminPanel from './AdminPanel';
import PageTooltips from './PageTooltips';
import { SUPERVISOR_TOOLTIPS } from '../lib/tourConfig';
import './SupervisorDashboard.css';

export default function SupervisorDashboard({ onExit, authFetch, currentUserId, tourActive, onTourEnd, onPageComplete }) {
  const [dashboard, setDashboard] = useState([]);
  const [summary, setSummary] = useState([]);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('briefing');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadDashboard();
    loadSummary();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await authFetch('/onboarding/supervisor/dashboard');
      const data = await res.json();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      showToast('error', 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (module = null) => {
    try {
      const url = module
        ? `/onboarding/supervisor/summary?module=${encodeURIComponent(module)}`
        : '/onboarding/supervisor/summary';
      const res = await authFetch(url);
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load summary:', error);
      showToast('error', 'Failed to load summary data.');
    }
  };

  const loadUserDetails = async (userId) => {
    try {
      const res = await authFetch(`/onboarding/supervisor/user/${encodeURIComponent(userId)}`);
      const data = await res.json();
      setUserDetails(data);
      setSelectedUser(userId);
    } catch (error) {
      console.error('Failed to load user details:', error);
      showToast('error', 'Failed to load user details.');
    }
  };

  const handleModuleClick = (module) => {
    const newModule = selectedModule === module ? null : module;
    setSelectedModule(newModule);
    loadSummary(newModule);
  };

  const filteredDashboard = selectedModule
    ? dashboard.filter(d => d.module === selectedModule)
    : dashboard;

  if (loading) {
    return (
      <div className="supervisor-dashboard">
        <div className="dashboard-header">
          <h1>Supervisor Dashboard</h1>
          <button onClick={onExit} className="exit-btn">&times; Back to Chat</button>
        </div>
        <div className="dashboard-tabs">
          <button className="tab-btn active">Briefing</button>
          <button className="tab-btn">Team Health</button>
          <button className="tab-btn">Team Onboarding</button>
          <button className="tab-btn">Knowledge Gaps</button>
          <button className="tab-btn">Pick Errors</button>
          <button className="tab-btn">Feedback</button>
          <button className="tab-btn">Admin</button>
        </div>
        <div className="summary-cards">
          <SkeletonSummaryCard />
          <SkeletonSummaryCard />
          <SkeletonSummaryCard />
          <SkeletonSummaryCard />
        </div>
        <div className="table-scroll-wrapper">
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
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
              <SkeletonTableRow />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="supervisor-dashboard">
      <div className="dashboard-header">
        <h1>Supervisor Dashboard</h1>
        <button onClick={onExit} className="exit-btn">&times; Back to Chat</button>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'briefing' ? 'active' : ''}`}
          onClick={() => setActiveTab('briefing')}
        >
          Briefing
        </button>
        <button
          className={`tab-btn ${activeTab === 'health' ? 'active' : ''}`}
          onClick={() => setActiveTab('health')}
        >
          Team Health
        </button>
        <button
          className={`tab-btn ${activeTab === 'onboarding' ? 'active' : ''}`}
          onClick={() => setActiveTab('onboarding')}
        >
          Team Onboarding
        </button>
        <button
          className={`tab-btn ${activeTab === 'gaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('gaps')}
        >
          Knowledge Gaps
        </button>
        <button
          className={`tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          Pick Errors
        </button>
        <button
          className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback
        </button>
        <button
          className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveTab('admin')}
        >
          Admin
        </button>
      </div>

      {activeTab === 'briefing' && (
        <DailyBriefing authFetch={authFetch} onNavigateTab={setActiveTab} />
      )}

      {activeTab === 'health' && <TeamHealth authFetch={authFetch} />}

      {activeTab === 'gaps' && <GapAnalysis authFetch={authFetch} />}

      {activeTab === 'errors' && <PickErrors authFetch={authFetch} />}

      {activeTab === 'feedback' && <FeedbackInbox authFetch={authFetch} />}

      {activeTab === 'admin' && <AdminPanel authFetch={authFetch} currentUserId={currentUserId} />}

      {activeTab === 'onboarding' && <>
      {/* Summary Cards */}
      <div className="summary-cards">
        {summary.map(s => (
          <div
            key={s.module}
            className={`summary-card ${selectedModule === s.module ? 'selected' : ''}`}
            onClick={() => handleModuleClick(s.module)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleModuleClick(s.module); } }}
            tabIndex={0}
            role="button"
          >
            <h3>{s.module}</h3>
            <div className="metric">
              <span className="number completed">{s.completed_users}</span>
              <span className="label">Completed</span>
            </div>
            <div className="metric">
              <span className="number in-progress">{s.in_progress_users}</span>
              <span className="label">In Progress</span>
            </div>
            {s.stalled_users > 0 && (
              <div className="metric warning">
                <span className="number stalled">{s.stalled_users}</span>
                <span className="label">Stalled (&gt;7 days)</span>
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

      {summary.length === 0 && (
        <div className="no-data">No onboarding data yet. Start onboarding some users to see data here.</div>
      )}

      {/* Filter Badge */}
      {selectedModule && (
        <div className="filter-badge">
          Showing: {selectedModule}
          <button onClick={() => { setSelectedModule(null); loadSummary(); }}>&times; Clear</button>
        </div>
      )}

      {/* Team Progress Table */}
      {filteredDashboard.length > 0 && (
        <div className="table-scroll-wrapper">
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
        </div>
      )}

      {filteredDashboard.length === 0 && summary.length > 0 && (
        <div className="no-data">
          No onboarding data {selectedModule ? `for ${selectedModule}` : ''} yet.
        </div>
      )}
      </>}

      {tourActive && (
        <PageTooltips tooltips={SUPERVISOR_TOOLTIPS} onSkipTour={onTourEnd} onPageComplete={onPageComplete} />
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
              &times;
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
