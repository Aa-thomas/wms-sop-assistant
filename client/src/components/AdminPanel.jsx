import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function AdminPanel({ authFetch, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingModules, setLoadingModules] = useState(true);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [updatingModule, setUpdatingModule] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type, user, title, message, confirmText, onConfirm }
  const [newUser, setNewUser] = useState({ username: '', password: '', is_supervisor: false });
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const toggleUserRole = async (user, confirmed = false) => {
    const newValue = !user.is_supervisor;
    const action = newValue ? 'promote' : 'demote';

    // Show confirmation for demotion
    if (!newValue && !confirmed) {
      setConfirmModal({
        type: 'demote',
        user,
        title: 'Remove Supervisor',
        message: `Remove supervisor privileges from ${user.username}?`,
        confirmText: 'Remove',
        onConfirm: () => toggleUserRole(user, true)
      });
      return;
    }

    setConfirmModal(null);
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

  const createUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await authFetch('/users', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = err.error || (err.errors && err.errors.map(e => e.msg).join(', ')) || 'Failed to create user';
        throw new Error(msg);
      }

      const created = await res.json();
      setUsers(prev => [...prev, created].sort((a, b) => a.username.localeCompare(b.username)));
      setNewUser({ username: '', password: '', is_supervisor: false });
      setShowAddUser(false);
      showToast('success', `User ${created.username} created.`);
    } catch (error) {
      console.error('Failed to create user:', error);
      showToast('error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (user, confirmed = false) => {
    const newValue = !user.is_active;
    const action = newValue ? 'enable' : 'disable';

    // Show confirmation for disabling
    if (!newValue && !confirmed) {
      setConfirmModal({
        type: 'disable',
        user,
        title: 'Disable User',
        message: `Disable ${user.username}? They won't be able to log in.`,
        confirmText: 'Disable',
        onConfirm: () => toggleUserStatus(user, true)
      });
      return;
    }

    setConfirmModal(null);
    setUpdatingUser(user.id);
    try {
      const res = await authFetch(`/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: newValue }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} user`);
      }

      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
      showToast('success', `${user.username} ${newValue ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      showToast('error', error.message);
    } finally {
      setUpdatingUser(null);
    }
  };

  const setPassword = async (e) => {
    e.preventDefault();
    if (!showPasswordModal) return;
    setSubmitting(true);

    try {
      const res = await authFetch(`/users/${showPasswordModal.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        const msg = err.error || (err.errors && err.errors.map(e => e.msg).join(', ')) || 'Failed to set password';
        throw new Error(msg);
      }

      setNewPassword('');
      setShowPasswordModal(null);
      showToast('success', `Password updated for ${showPasswordModal.username}.`);
    } catch (error) {
      console.error('Failed to set password:', error);
      showToast('error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWelcomeTour = async (user) => {
    setUpdatingUser(user.id);
    try {
      const res = await authFetch(`/users/${user.id}/welcome-reset`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset welcome tour');
      }

      showToast('success', `Welcome tour will show on ${user.username}'s next login.`);
    } catch (error) {
      console.error('Failed to reset welcome tour:', error);
      showToast('error', error.message);
    } finally {
      setUpdatingUser(null);
    }
  };

  const deleteUser = async (user, confirmed = false) => {
    if (!confirmed) {
      setConfirmModal({
        type: 'delete',
        user,
        title: 'Delete User',
        message: `Delete ${user.username}? This action cannot be undone.`,
        confirmText: 'Delete',
        onConfirm: () => deleteUser(user, true)
      });
      return;
    }

    setConfirmModal(null);
    setUpdatingUser(user.id);
    try {
      const res = await authFetch(`/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete user');
      }

      setUsers(prev => prev.filter(u => u.id !== user.id));
      showToast('success', `${user.username} deleted.`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      showToast('error', error.message);
    } finally {
      setUpdatingUser(null);
    }
  };

  return (
    <div className="admin-panel">
      {/* User Management Section */}
      <section className="admin-section">
        <div className="admin-section-header">
          <h3 className="admin-section-title">User Management</h3>
          <button className="add-user-btn" onClick={() => setShowAddUser(true)}>+ Add User</button>
        </div>
        {loadingUsers ? (
          <div className="no-data">Loading users...</div>
        ) : (
          <div className="table-scroll-wrapper">
            <table className="progress-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isSelf = user.id.toString() === currentUserId?.toString();
                  return (
                    <tr key={user.id} className={user.is_active === false ? 'disabled-user' : ''}>
                      <td>
                        {user.username}
                        {isSelf && <span className="you-badge">you</span>}
                      </td>
                      <td>
                        <span className={`role-badge ${user.is_supervisor ? 'supervisor' : 'operator'}`}>
                          {user.is_supervisor ? 'Supervisor' : 'Operator'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.is_active !== false ? 'active' : 'inactive'}`}>
                          {user.is_active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>{user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                      <td className="action-buttons">
                        <button
                          className={`action-btn ${user.is_supervisor ? 'demote' : 'promote'}`}
                          onClick={() => toggleUserRole(user)}
                          disabled={isSelf || updatingUser === user.id}
                          title={isSelf ? 'Cannot change your own role' : (user.is_supervisor ? 'Remove Supervisor' : 'Make Supervisor')}
                        >
                          {user.is_supervisor ? '👤' : '⭐'}
                        </button>
                        <button
                          className="action-btn password"
                          onClick={() => setShowPasswordModal(user)}
                          disabled={updatingUser === user.id}
                          title="Set Password"
                        >
                          🔑
                        </button>
                        <button
                          className={`action-btn ${user.is_active !== false ? 'disable' : 'enable'}`}
                          onClick={() => toggleUserStatus(user)}
                          disabled={isSelf || updatingUser === user.id}
                          title={isSelf ? 'Cannot disable yourself' : (user.is_active !== false ? 'Disable User' : 'Enable User')}
                        >
                          {user.is_active !== false ? '🚫' : '✓'}
                        </button>
                        <button
                          className="action-btn tour"
                          onClick={() => resetWelcomeTour(user)}
                          disabled={updatingUser === user.id}
                          title="Reset welcome tour — user will see it on next login"
                        >
                          🎓
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => deleteUser(user)}
                          disabled={isSelf || updatingUser === user.id}
                          title={isSelf ? 'Cannot delete yourself' : 'Delete User'}
                        >
                          🗑️
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

      {/* Add User Modal */}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add New User</h2>
            <button className="close-modal" onClick={() => setShowAddUser(false)}>&times;</button>
            <form onSubmit={createUser}>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={e => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  required
                  minLength={3}
                  maxLength={50}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={8}
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={newUser.is_supervisor}
                    onChange={e => setNewUser(prev => ({ ...prev, is_supervisor: e.target.checked }))}
                  />
                  Supervisor
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowAddUser(false)}>Cancel</button>
                <button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Set Password for {showPasswordModal.username}</h2>
            <button className="close-modal" onClick={() => setShowPasswordModal(null)}>&times;</button>
            <form onSubmit={setPassword}>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowPasswordModal(null)}>Cancel</button>
                <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Set Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <h2>{confirmModal.title}</h2>
            <button className="close-modal" onClick={() => setConfirmModal(null)}>&times;</button>
            <p className="confirm-message">{confirmModal.message}</p>
            <div className="form-actions">
              <button type="button" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                type="button"
                className={`confirm-btn ${confirmModal.type}`}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

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
