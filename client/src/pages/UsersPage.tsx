import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type UserItem, type DepartmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';
import { TemporaryPasswordModal } from '../components/TemporaryPasswordModal';
import './UsersPage.css';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Employee / Doctor' },
  { value: 'HOD', label: 'Head of Department (HOD)' },
  { value: 'DIRECTOR', label: 'Hospital Director' },
  { value: 'MEDICAL_SUPERINTENDENT', label: 'Medical Superintendent' },
  { value: 'HR', label: 'HR Officer' },
  { value: 'PURCHASE_OFFICER', label: 'Procurement Officer' },
  { value: 'MAINTENANCE_OFFICER', label: 'Maintenance Officer' },
  { value: 'FINANCE_OFFICER', label: 'Finance Officer' },
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
  const [password, setPassword] = useState('');

  // Temporary password modal state
  const [tempPasswordModal, setTempPasswordModal] = useState<{
    isOpen: boolean;
    email: string;
    tempPass: string;
    expiresAt?: string;
  }>({
    isOpen: false,
    email: '',
    tempPass: '',
  });

  // Admin password re-auth prompt for reset
  const [adminPasswordPrompt, setAdminPasswordPrompt] = useState<{
    isOpen: boolean;
    targetUserId: string;
    targetUserEmail: string;
    isPrivileged: boolean;
    adminPassword: string;
    error?: string;
  }>({
    isOpen: false,
    targetUserId: '',
    targetUserEmail: '',
    isPrivileged: false,
    adminPassword: '',
  });
  const [isResetting, setIsResetting] = useState(false);

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

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, isSubmitting]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      const res = await api.createUser({
        employeeId,
        email,
        firstName,
        lastName,
        role,
        departmentId,
        password: password.trim() ? password.trim() : undefined,
      });
      setShowModal(false);
      // Reset form
      setEmployeeId('');
      setEmail('');
      setFirstName('');
      setLastName('');
      setRole('EMPLOYEE');
      setPassword('');
      await fetchUsersAndDepts();

      // Show temporary password modal
      if (res.data?.temporaryPassword) {
        setTempPasswordModal({
          isOpen: true,
          email: res.data.email,
          tempPass: res.data.temporaryPassword,
        });
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateReset = (u: UserItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const privilegedRoles = ['ADMIN', 'HOD', 'DIRECTOR'];
    const isPrivileged = privilegedRoles.includes(u.role);
    setAdminPasswordPrompt({
      isOpen: true,
      targetUserId: u.id,
      targetUserEmail: u.email,
      isPrivileged,
      adminPassword: '',
    });
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordPrompt.targetUserId) return;
    setIsResetting(true);
    try {
      const res = await api.resetPassword(
        adminPasswordPrompt.targetUserId,
        adminPasswordPrompt.isPrivileged ? adminPasswordPrompt.adminPassword : undefined
      );
      const email = adminPasswordPrompt.targetUserEmail;
      setAdminPasswordPrompt({
        isOpen: false,
        targetUserId: '',
        targetUserEmail: '',
        isPrivileged: false,
        adminPassword: '',
      });
      setTempPasswordModal({
        isOpen: true,
        email,
        tempPass: res.data.temporaryPassword,
        expiresAt: res.data.expiresAt,
      });
      await fetchUsersAndDepts();
    } catch (err: any) {
      setAdminPasswordPrompt((prev) => ({
        ...prev,
        error: err?.message || 'Failed to reset password.',
      }));
    } finally {
      setIsResetting(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesDept = !deptFilter || u.department?.id === deptFilter;
    const matchesStatus =
      !statusFilter || (statusFilter === 'active' ? u.isActive : !u.isActive);

    return matchesSearch && matchesRole && matchesDept && matchesStatus;
  });

  return (
    <DashboardLayout
      title="E-Office"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <TemporaryPasswordModal
        isOpen={tempPasswordModal.isOpen}
        userEmail={tempPasswordModal.email}
        temporaryPassword={tempPasswordModal.tempPass}
        expiresAt={tempPasswordModal.expiresAt}
        onClose={() =>
          setTempPasswordModal({
            isOpen: false,
            email: '',
            tempPass: '',
          })
        }
      />

      {/* Admin Re-authentication Modal for Privileged Password Reset */}
      {adminPasswordPrompt.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => {
            if (!isResetting) {
              setAdminPasswordPrompt({ isOpen: false, targetUserId: '', targetUserEmail: '', isPrivileged: false, adminPassword: '' });
            }
          }}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-left relative border border-slate-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-base font-bold text-slate-900 mb-2">Reset User Password</h3>
            <p className="text-xs text-slate-600 mb-4">
              Generate a temporary password for{' '}
              <strong className="text-slate-900">{adminPasswordPrompt.targetUserEmail}</strong>.
              {adminPasswordPrompt.isPrivileged && (
                <span className="block mt-2 text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠ This user holds a privileged role. Re-enter your Administrator password to confirm.
                </span>
              )}
            </p>

            {adminPasswordPrompt.error && (
              <div className="mb-3 p-2.5 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
                {adminPasswordPrompt.error}
              </div>
            )}

            <form onSubmit={handleConfirmReset} className="space-y-4">
              {adminPasswordPrompt.isPrivileged && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Administrator Password
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPasswordPrompt.adminPassword}
                    onChange={(e) =>
                      setAdminPasswordPrompt((prev) => ({
                        ...prev,
                        adminPassword: e.target.value,
                      }))
                    }
                    placeholder="Enter your admin password"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() =>
                    setAdminPasswordPrompt({ isOpen: false, targetUserId: '', targetUserEmail: '', isPrivileged: false, adminPassword: '' })
                  }
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 rounded-md shadow-xs disabled:opacity-50"
                >
                  {isResetting ? 'Resetting...' : 'Generate Temporary Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="users-page-container">
        <div className="users-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Users</h1>
            <p className="text-slate-500 mt-1">Manage system access, roles, and departmental assignments</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto h-10 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md shadow-2xs text-sm transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Create user
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200/80 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name, email, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Department</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.displayName || d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Loading users..." />
        ) : error ? (
          <div className="state-card error-state">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchUsersAndDepts}>Retry</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
            No users match your criteria.
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
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} onClick={() => navigate(`/admin/users/${u.id}`)} className="cursor-pointer hover:bg-slate-50/80">
                    <td>
                      <div className="user-name font-semibold text-slate-900">
                        {u.firstName} {u.lastName}
                      </div>
                      <div className="user-email text-xs text-slate-500">{u.email} • {u.employeeId}</div>
                    </td>
                    <td>
                      <span className="role-badge font-medium text-xs">
                        {u.roleRef?.displayName || u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{u.department?.displayName || u.department?.name || '—'}</td>
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`status-badge ${u.isActive ? 'status-active' : 'status-inactive'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {u.mustChangePassword && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            Must Change Password
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleInitiateReset(u, e)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CREATE USER MODAL */}
        {showModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => { if (!isSubmitting) setShowModal(false); }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left relative border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-modal-title"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <h3 id="user-modal-title" className="text-lg font-bold text-slate-900">Create New System User</h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  aria-label="Close dialog"
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
                      placeholder="you@eoffice.com"
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Initial Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to auto-generate a secure temporary password"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    If left blank, a cryptographically secure 16-character password will be generated.
                  </span>
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
                    className="px-4 py-2 text-sm font-semibold bg-blue-700 text-white hover:bg-blue-800 rounded-md shadow-sm disabled:opacity-50"
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
