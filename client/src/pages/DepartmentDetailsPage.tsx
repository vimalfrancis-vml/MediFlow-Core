import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type DepartmentItem, type UserItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';
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

  // Edit details state
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);

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
      setEditDisplayName(deptRes.data.displayName || deptRes.data.name);
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

  useEffect(() => {
    if (!showHodModal && !showStatusConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setShowHodModal(false);
        setShowStatusConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHodModal, showStatusConfirm, isSubmitting]);

  const handleUpdateHod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    setError(null);
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

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await api.updateDepartment(id, { displayName: editDisplayName.trim() });
      setActionSuccess('Department display name updated.');
      setIsEditing(false);
      await fetchDepartmentData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update department details');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!id || !department) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const nextStatus = !department.isActive;
      await api.setDepartmentStatus(id, nextStatus);
      setActionSuccess(`Department successfully ${nextStatus ? 'activated' : 'deactivated'}.`);
      setShowStatusConfirm(false);
      await fetchDepartmentData();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update department status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <div className="department-details-container max-w-5xl mx-auto">
        <button className="back-button mb-4 text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => navigate('/admin/departments')}>
          &larr; Back to Departments
        </button>

        {actionSuccess && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {actionSuccess}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-md border border-red-200">
            ✕ {error}
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
            <div className="details-card bg-white p-6 rounded-xl shadow-xs border border-slate-200">
              <div className="details-header flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{department.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`status-badge ${department.isActive ? 'status-active' : 'status-inactive'}`}>
                      {department.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-slate-400">• Code: {department.code}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                  >
                    {isEditing ? 'Cancel Edit' : '✎ Edit Display Name'}
                  </button>
                  <button
                    onClick={() => setShowHodModal(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-md text-xs transition-colors"
                  >
                    Assign / Change HOD
                  </button>
                  <button
                    onClick={() => setShowStatusConfirm(true)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md shadow-xs transition-colors ${
                      department.isActive
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {department.isActive ? 'Deactivate Department' : 'Activate Department'}
                  </button>
                </div>
              </div>

              {isEditing && (
                <form onSubmit={handleSaveDisplayName} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Display Name</label>
                    <input
                      type="text"
                      required
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Name'}
                  </button>
                </form>
              )}

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
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
                onClick={() => { if (!isSubmitting) setShowHodModal(false); }}
              >
                <div 
                  className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left relative border border-slate-200"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="hod-modal-title"
                >
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                    <h3 id="hod-modal-title" className="text-lg font-bold text-slate-900">Assign Head of Department</h3>
                    <button
                      type="button"
                      onClick={() => setShowHodModal(false)}
                      disabled={isSubmitting}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                      aria-label="Close dialog"
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

            {/* STATUS CONFIRMATION MODAL */}
            {showStatusConfirm && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
                onClick={() => { if (!isSubmitting) setShowStatusConfirm(false); }}
              >
                <div 
                  className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-left border border-slate-200"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="status-confirm-title"
                >
                  <h3 id="status-confirm-title" className="text-base font-bold text-slate-900 mb-2">
                    {department.isActive ? 'Deactivate Department?' : 'Activate Department?'}
                  </h3>
                  <p className="text-xs text-slate-600 mb-4">
                    {department.isActive
                      ? `Are you sure you want to deactivate ${department.name}? Users will not be able to be assigned to this department and routing will be restricted.`
                      : `Are you sure you want to activate ${department.name}? It will become available for departmental assignments.`}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowStatusConfirm(false)}
                      className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleStatus}
                      disabled={isSubmitting}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-xs ${
                        department.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      {isSubmitting ? 'Processing...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
