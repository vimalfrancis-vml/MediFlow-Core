import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type DepartmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './DepartmentDetailsPage.css';
import './UserDetailsPage.css'; // Reuse details card styles
import './UsersPage.css'; // Reuse badges

export default function DepartmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<DepartmentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartment = async () => {
      if (!id) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const res = await api.getDepartmentById(id);
        setDepartment(res.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load department details');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDepartment();
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
      <div className="department-details-container">
        <button className="back-button" onClick={() => navigate('/admin/departments')}>
          &larr; Back to Departments
        </button>

        {isLoading ? (
          <LoadingState message="Loading details..." />
        ) : error || !department ? (
          <div className="state-card error-state">
            <p>{error || 'Department not found'}</p>
          </div>
        ) : (
          <>
            <div className="details-card">
              <div className="details-header">
                <h2>{department.name}</h2>
                <span className={`status-badge ${department.isActive ? 'status-active' : 'status-inactive'}`}>
                  {department.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Department Code</span>
                  <span className="detail-value">{department.code}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Head of Department</span>
                  <span className="detail-value">
                    {department.hod ? `${department.hod.firstName} ${department.hod.lastName}` : 'Not assigned'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Total Requests</span>
                  <span className="detail-value">
                    <span className={`count-badge ${(department._count?.requests || 0) > 0 ? 'has-requests' : ''}`}>
                      {department._count?.requests || 0}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div className="dept-employees-section">
              <h3>Department Employees ({department._count?.users || 0})</h3>
              
              {!department.users || department.users.length === 0 ? (
                <div className="empty-employees">
                  No employees assigned to this department.
                </div>
              ) : (
                <table className="dept-users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {department.users.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-name">
                            {user.firstName} {user.lastName}
                          </div>
                        </td>
                        <td>
                          <span className="role-badge">{user.role.replace(/_/g, ' ')}</span>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

