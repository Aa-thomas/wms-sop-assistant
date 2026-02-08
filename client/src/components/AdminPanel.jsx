import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function AdminPanel({ authFetch, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [updatingModule, setUpdatingModule] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadUsers();
    loadModuleAssignments();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await authFetch('/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      showToast('error', 'Failed to load users.');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadModuleAssignments = async () => {
    try {
      const res = await authFetch('/modules/assignments');
      const data = await res.json();
      setAssignments(data);
    } catch (error) {
      console.error('Failed to load module assignments:', error);
      showToast('error', 'Failed to load module assignments.');
    } finally {
      setLoadingModules(false);
    }
  };

  const toggleUserRole = async (user) => {
    const newValue = !user.is_supervisor;
    const action = newValue ? 'promote' : 'demote';

    if (!newValue && !window.confirm(`Remove supervisor privileges from ${user.username}?`)) {
      return;
    }

    setUpdatingUser(user.id);
    try {
      const res = await authFetch(`/users/${user.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ is_supervisor: newValue }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} user`);
      }

      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      showToast('success', `${user.username} ${newValue ? 'promoted to' : 'removed as'} supervisor.`);
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      showToast('error', error.message);
    } finally {
      setUpdatingUser(null);
    }
  };

  const toggleModuleAccess = async (module, role, currentValue) => {
    const newValue = !currentValue;
    setUpdatingModule(`${module}-${role}`);

    try {
      const res = await authFetch('/modules/assignments', {
        method: 'PATCH',
        body: JSON.stringify({ module, role, enabled: newValue }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update module access');
      }

      setAssignments(prev => ({
        ...prev,
        [module]: {
          ...prev[module],
          [role]: newValue
        }
      }));

      const roleLabel = role === 'operator' ? 'Operators' : 'Supervisors';
      showToast('success', `${assignments[module].label} ${newValue ? 'enabled' : 'disabled'} for ${roleLabel}.`);
    } catch (error) {
      console.error('Failed to update module access:', error);
      showToast('error', error.message);
    } finally {
      setUpdatingModule(null);
    }
  };

  return (
    <div className="admin-panel">
      {/* User Management Section */}
      <section className="admin-section">
        <h3 className="admin-section-title">User Management</h3>
        {loadingUsers ? (
          <div className="no-data">Loading users...</div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="progress-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isSelf = user.id.toString() === currentUserId?.toString();
                  return (
                    <tr key={user.id}>
                      <td>
                        {user.username}
                        {isSelf && <span className="you-badge">you</span>}
                      </td>
                      <td>
                        <span className={`role-badge ${user.is_supervisor ? 'supervisor' : 'operator'}`}>
                          {user.is_supervisor ? 'Supervisor' : 'Operator'}
                        </span>
                      </td>
                      <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className={`role-toggle-btn ${user.is_supervisor ? 'demote' : 'promote'}`}
                          onClick={() => toggleUserRole(user)}
                          disabled={isSelf || updatingUser === user.id}
                          title={isSelf ? 'Cannot change your own role' : ''}
                        >
                          {updatingUser === user.id
                            ? '...'
                            : user.is_supervisor
                              ? 'Remove Supervisor'
                              : 'Make Supervisor'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Module Access Section */}
      <section className="admin-section">
        <h3 className="admin-section-title">Module Access</h3>
        <p className="admin-section-desc">Control which modules are visible to each role.</p>
        {loadingModules ? (
          <div className="no-data">Loading module assignments...</div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="progress-table module-access-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Operators</th>
                  <th>Supervisors</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(assignments).map(([module, config]) => (
                  <tr key={module}>
                    <td>{config.label}</td>
                    <td>
                      <button
                        className={`module-toggle-btn ${config.operator ? 'enabled' : 'disabled'}`}
                        onClick={() => toggleModuleAccess(module, 'operator', config.operator)}
                        disabled={updatingModule === `${module}-operator`}
                      >
                        {updatingModule === `${module}-operator` ? '...' : config.operator ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`module-toggle-btn ${config.supervisor ? 'enabled' : 'disabled'}`}
                        onClick={() => toggleModuleAccess(module, 'supervisor', config.supervisor)}
                        disabled={updatingModule === `${module}-supervisor`}
                      >
                        {updatingModule === `${module}-supervisor` ? '...' : config.supervisor ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
