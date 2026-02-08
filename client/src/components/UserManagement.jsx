import { useState, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export default function UserManagement({ authFetch, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadUsers();
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
      setLoading(false);
    }
  };

  const toggleRole = async (user) => {
    const newValue = !user.is_supervisor;
    const action = newValue ? 'promote' : 'demote';

    if (!newValue && !window.confirm(`Remove supervisor privileges from ${user.username}?`)) {
      return;
    }

    setUpdating(user.id);
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
      setUpdating(null);
    }
  };

  if (loading) {
    return <div className="no-data">Loading users...</div>;
  }

  return (
    <div className="user-management">
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
                      onClick={() => toggleRole(user)}
                      disabled={isSelf || updating === user.id}
                      title={isSelf ? 'Cannot change your own role' : ''}
                    >
                      {updating === user.id
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
    </div>
  );
}
