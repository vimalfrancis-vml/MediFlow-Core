import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type UserItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './UserDetailsPage.css';
import './UsersPage.css';

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  useEffect(() => {
    fetchUser();
  }, [id]);

  const handleToggleActive = async () => {
    if (!user || !id) return;
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const updatedStatus = !user.isActive;
      await api.updateUser(id, { isActive: updatedStatus });
      setActionMessage(`User account successfully ${updatedStatus ? 'activated' : 'deactivated'}.`);
      await fetchUser();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={
        <nav className="admin-nav flex items-center gap-1 sm:gap-2 mr-2 sm:mr-4">
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors" onClick={() => navigate('/admin')}>Overview</button>
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-semibold bg-indigo-50 text-indigo-700 transition-colors" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors" onClick={() => navigate('/admin/departments')}>Departments</button>
        </nav>
      }
    >
      <div className="user-details-container">
        <button className="back-button" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>

        {actionMessage && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {actionMessage}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading details..." />
        ) : error || !user ? (
          <div className="state-card error-state">
            <p>{error || 'User not found'}</p>
          </div>
        ) : (
          <div className="details-card">
            <div className="details-header flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
                <span className={`status-badge mt-1 inline-block ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <button
                onClick={handleToggleActive}
                disabled={isUpdating}
                className={`px-4 py-2 text-xs font-bold rounded-md shadow-sm transition-colors ${
                  user.isActive
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isUpdating
                  ? 'Updating...'
                  : user.isActive
                  ? 'Deactivate User Account'
                  : 'Activate User Account'}
              </button>
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
