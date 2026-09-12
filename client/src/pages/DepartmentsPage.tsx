import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DepartmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  useEffect(() => {
    if (!showCreateModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isCreating) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal, isCreating]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      await api.createDepartment({
        name: createName.trim(),
        code: createCode.trim().toUpperCase(),
        displayName: createDisplayName.trim() || undefined,
      });
      setShowCreateModal(false);
      setCreateName('');
      setCreateCode('');
      setCreateDisplayName('');
      await fetchDepartments();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create department');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <div className="departments-page-container">
        <div className="departments-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Departments</h1>
            <p className="text-slate-500 mt-1">Configure hospital departments, HODs, and routing scopes</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-xs text-sm transition-colors whitespace-nowrap"
          >
            + Create Department
          </button>
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

        {/* CREATE DEPARTMENT MODAL */}
        {showCreateModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => { if (!isCreating) setShowCreateModal(false); }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dept-create-title"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 id="dept-create-title" className="text-lg font-bold text-slate-900">Create New Department</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                  {createError}
                </div>
              )}

              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NEUR"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md uppercase focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">Short unique identifier (3-5 letters uppercase)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Neurology"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Display Label <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Department of Clinical Neurology"
                    value={createDisplayName}
                    onChange={(e) => setCreateDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isCreating ? 'Creating...' : 'Create Department'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

