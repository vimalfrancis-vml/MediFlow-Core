import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type UserItem } from '../services/api';
import './UsersPage.css';

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.getUsers();
      setUsers(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="users-page-container">
      <div className="users-header">
        <div>
          <h1>System Users</h1>
          <p>Read-only view of all users</p>
        </div>
      </div>

      {isLoading ? (
        <div className="state-card loading-state">
          <div className="loading-spinner" />
          <p>Loading users...</p>
        </div>
      ) : error ? (
        <div className="state-card error-state">
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchUsers}>Retry</button>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} onClick={() => navigate(`/admin/users/${user.id}`)}>
                  <td>
                    <div className="user-name">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="user-email">{user.email}</div>
                  </td>
                  <td>
                    <span className="role-badge">
                      {user.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>{user.department?.name || '—'}</td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
