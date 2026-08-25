import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type DepartmentItem, type UserItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './DepartmentDetailsPage.css';
import './UserDetailsPage.css';
import './UsersPage.css';

export default function DepartmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [department, setDepartment] = useState<DepartmentItem | null>(null);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHodModal, setShowHodModal] = useState(false);
  const [selectedHodId, setSelectedHodId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDepartmentData = async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [deptRes, userRes] = await Promise.all([
        api.getDepartmentById(id),
        api.getUsers(),
      ]);
      setDepartment(deptRes.data);
      setAllUsers(userRes.data);
      if (deptRes.data.hod) {
        setSelectedHodId(deptRes.data.hod.id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load department details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentData();
  }, [id]);

  const handleUpdateHod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    try {
      await api.updateDepartmentHod(id, selectedHodId || null);
      setActionSuccess('Head of Department updated successfully.');
      setShowHodModal(false);
      await fetchDepartmentData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update HOD');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={
        <nav className="admin-nav flex items-center gap-1 sm:gap-2 mr-2 sm:mr-4">
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors" onClick={() => navigate('/admin')}>Overview</button>
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-semibold bg-indigo-50 text-indigo-700 transition-colors" onClick={() => navigate('/admin/departments')}>Departments</button>
        </nav>
      }
    >
      <div className="department-details-container">
        <button className="back-button" onClick={() => navigate('/admin/departments')}>
          &larr; Back to Departments
        </button>

        {actionSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {actionSuccess}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading details..." />
        ) : error || !department ? (
          <div className="state-card error-state">
            <p>{error || 'Department not found'}</p>
          </div>
        ) : (
          <>
            <div className="details-card">
              <div className="details-header flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{department.name}</h2>
                  <span className={`status-badge mt-1 inline-block ${department.isActive ? 'status-active' : 'status-inactive'}`}>
                    {department.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  onClick={() => setShowHodModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs shadow-sm transition-colors"
                >
                  ✎ Assign / Change HOD
                </button>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Department Code</span>
                  <span className="detail-value">{department.code}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Head of Department (HOD)</span>
                  <span className="detail-value font-semibold text-indigo-900">
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

            <div className="dept-employees-section text-left mt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h3 className="text-base font-bold text-slate-900 m-0">Department Employees ({department._count?.users || 0})</h3>
                <button
                  onClick={() => navigate('/admin/users')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md text-xs shadow-sm transition-colors whitespace-nowrap"
                >
                  + Create New User
                </button>
              </div>
              
              {!department.users || department.users.length === 0 ? (
                <div className="empty-employees p-6 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  No employees assigned to this department.
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
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
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td>
                            <div className="user-name font-semibold text-slate-900">
                              {user.firstName} {user.lastName}
                            </div>
                          </td>
                          <td>
                            <span className="role-badge">{user.role.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="text-slate-600 text-sm">{user.email}</td>
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

            {/* ASSIGN / CHANGE HOD MODAL */}
            {showHodModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-left relative fade-in">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Assign Head of Department</h3>
                    <button
                      onClick={() => setShowHodModal(false)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleUpdateHod} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Select HOD User</label>
                      <select
                        value={selectedHodId}
                        onChange={(e) => setSelectedHodId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                      >
                        <option value="">-- No HOD Assigned --</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} ({u.role}) — {u.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowHodModal(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-md shadow-sm disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Save HOD Assignment'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
