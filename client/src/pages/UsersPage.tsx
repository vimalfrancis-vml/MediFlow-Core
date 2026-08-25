import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type UserItem, type DepartmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './UsersPage.css';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employee / Doctor' },
  { value: 'HOD', label: 'Head of Department (HOD)' },
  { value: 'DIRECTOR', label: 'Hospital Director' },
  { value: 'MEDICAL_SUPERINTENDENT', label: 'Medical Superintendent' },
  { value: 'HR', label: 'HR Officer' },
  { value: 'PURCHASE_OFFICER', label: 'Procurement Officer' },
  { value: 'MAINTENANCE_OFFICER', label: 'Maintenance Officer' },
  { value: 'ADMIN', label: 'System Administrator' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('password123');

  const navigate = useNavigate();

  const fetchUsersAndDepts = async () => {
    try {
      setIsLoading(true);
      const [uRes, dRes] = await Promise.all([
        api.getUsers(),
        api.getDepartments(),
      ]);
      setUsers(uRes.data);
      setDepartments(dRes.data);
      if (dRes.data.length > 0 && !departmentId) {
        setDepartmentId(dRes.data[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndDepts();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.createUser({
        employeeId,
        email,
        firstName,
        lastName,
        role,
        departmentId,
        password,
      });
      setShowModal(false);
      // Reset form
      setEmployeeId('');
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('EMPLOYEE');
      setPassword('password123');
      await fetchUsersAndDepts();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user');
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
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-semibold bg-indigo-50 text-indigo-700 transition-colors" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="px-3 py-1 rounded-md text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors" onClick={() => navigate('/admin/departments')}>Departments</button>
        </nav>
      }
    >
      <div className="users-page-container">
        <div className="users-header flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Users</h1>
            <p className="text-slate-500 mt-1">Manage system access, roles, and departmental assignments</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm text-sm transition-colors"
          >
            + Create New User
          </button>
        </div>

        {isLoading ? (
          <LoadingState message="Loading users..." />
        ) : error ? (
          <div className="state-card error-state">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchUsersAndDepts}>Retry</button>
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

        {/* CREATE USER MODAL */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-left relative fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-lg font-bold text-slate-900">Create New System User</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Employee ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP-109"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="user@mediflow.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
                    <input
                      type="text"
                      required
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">System Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Default: password123"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-md shadow-sm disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create User'}
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
