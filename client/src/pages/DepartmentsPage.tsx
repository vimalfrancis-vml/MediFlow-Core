import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DepartmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './DepartmentsPage.css';
import './UsersPage.css'; // For status badges

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const res = await api.getDepartments();
      setDepartments(res.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load departments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

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
      <div className="departments-page-container">
        <div className="departments-header">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Departments</h1>
            <p className="text-slate-500 mt-1">Read-only view of all departments</p>
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Loading departments..." />
        ) : error ? (
          <div className="state-card error-state">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchDepartments}>Retry</button>
          </div>
        ) : (
          <div className="departments-table-container">
            <table className="departments-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Head of Department (HOD)</th>
                  <th>Employees</th>
                  <th>Total Requests</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} onClick={() => navigate(`/admin/departments/${dept.id}`)}>
                    <td>
                      <div className="dept-name">{dept.name}</div>
                      <div className="dept-code">{dept.code}</div>
                    </td>
                    <td>
                      {dept.hod ? `${dept.hod.firstName} ${dept.hod.lastName}` : 'Not assigned'}
                    </td>
                    <td>
                      <span className="count-badge">
                        {dept._count?.users || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`count-badge ${(dept._count?.requests || 0) > 0 ? 'has-requests' : ''}`}>
                        {dept._count?.requests || 0}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${dept.isActive ? 'status-active' : 'status-inactive'}`}>
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

