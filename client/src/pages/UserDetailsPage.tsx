import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type UserItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './UserDetailsPage.css';
import './UsersPage.css'; // Reuse badge styles

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const res = await api.getUserById(id);
        setUser(res.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load user details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={
        <nav className="admin-nav flex items-center gap-4 mr-4">
          <button className="nav-link-btn text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/admin')}>Overview</button>
          <button className="nav-link-btn text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="nav-link-btn text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/admin/departments')}>Departments</button>
        </nav>
      }
    >
      <div className="user-details-container">
        <button className="back-button" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>

        {isLoading ? (
          <LoadingState message="Loading details..." />
        ) : error || !user ? (
          <div className="state-card error-state">
            <p>{error || 'User not found'}</p>
          </div>
        ) : (
          <div className="details-card">
            <div className="details-header">
              <h2 className="text-xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
              <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Employee ID</span>
                <span className="detail-value">{user.employeeId}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Email Address</span>
                <span className="detail-value">{user.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Role</span>
                <span className="detail-value">
                  <span className="role-badge">{user.role.replace(/_/g, ' ')}</span>
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Department</span>
                <span className="detail-value">{user.department?.name || 'Unassigned'}</span>
              </div>
              {user.department && (
                <div className="detail-item">
                  <span className="detail-label">Department Code</span>
                  <span className="detail-value">{user.department.code}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

