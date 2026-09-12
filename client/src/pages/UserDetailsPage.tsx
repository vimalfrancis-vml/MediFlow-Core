import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type UserItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import './UserDetailsPage.css';
import './UsersPage.css';

import { AdminNav } from '../components/AdminNav';

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserItem | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Edit fields
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');

  const fetchUserData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [uRes, dRes, rRes] = await Promise.all([
        api.getUserById(id),
        api.getDepartments(),
        api.getRoles(true),
      ]);
      setUser(uRes.data);
      setFirstName(uRes.data.firstName);
      setLastName(uRes.data.lastName);
      setSelectedRole(uRes.data.role);
      setSelectedDeptId(uRes.data.department?.id || '');
      setDepartments(dRes.data || []);
      setRoles(rRes.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load user details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [id]);

  useEffect(() => {
    if (!showConfirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUpdating) {
        setShowConfirmModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirmModal, isUpdating]);

  const handleToggleActive = async () => {
    if (!user || !id) return;
    setIsUpdating(true);
    setError(null);
    try {
      const updatedStatus = !user.isActive;
      await api.updateUser(id, { isActive: updatedStatus });
      setActionMessage(`User account successfully ${updatedStatus ? 'activated' : 'deactivated'}.`);
      setShowConfirmModal(false);
      await fetchUserData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsUpdating(true);
    setError(null);
    try {
      await api.updateUser(id, {
        firstName,
        lastName,
        role: selectedRole,
        departmentId: selectedDeptId,
      });
      setActionMessage('User details updated successfully.');
      setIsEditing(false);
      await fetchUserData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save user updates');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <div className="user-details-container max-w-4xl mx-auto">
        <button className="back-button mb-4 text-xs font-semibold text-slate-500 hover:text-slate-800" onClick={() => navigate('/admin/users')}>
          &larr; Back to Users
        </button>

        {actionMessage && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {actionMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-md border border-red-200">
            ✕ {error}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading details..." />
        ) : !user ? (
          <div className="state-card error-state">
            <p>User not found</p>
          </div>
        ) : (
          <div className="details-card bg-white p-6 rounded-xl shadow-xs border border-slate-200">
            <div className="details-header flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`status-badge ${user.isActive ? 'status-active' : 'status-inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-slate-400">• Employee ID: {user.employeeId}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                >
                  {isEditing ? 'Cancel Editing' : '✎ Edit Profile'}
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isUpdating}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md shadow-xs transition-colors ${
                    user.isActive
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {user.isActive ? 'Deactivate Account' : 'Activate Account'}
                </button>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">First Name</label>
                    <input
                      type="text"
                      required
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
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">System Role</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.displayName} ({r.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Department</label>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.displayName || d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="details-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="detail-item">
                  <span className="detail-label block text-xs font-bold text-slate-400 uppercase">Employee ID</span>
                  <span className="detail-value text-sm font-semibold text-slate-800">{user.employeeId}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label block text-xs font-bold text-slate-400 uppercase">Email Address</span>
                  <span className="detail-value text-sm font-semibold text-slate-800">{user.email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label block text-xs font-bold text-slate-400 uppercase">Role</span>
                  <span className="detail-value text-sm font-semibold text-slate-800">
                    {user.roleRef?.displayName || user.role.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label block text-xs font-bold text-slate-400 uppercase">Department</span>
                  <span className="detail-value text-sm font-semibold text-slate-800">
                    {user.department?.displayName || user.department?.name || 'Unassigned'} ({user.department?.code})
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => { if (!isUpdating) setShowConfirmModal(false); }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-left border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-confirm-title"
            >
              <h3 id="user-confirm-title" className="text-base font-bold text-slate-900 mb-2">
                {user?.isActive ? 'Deactivate User Account?' : 'Activate User Account?'}
              </h3>
              <p className="text-xs text-slate-600 mb-4">
                {user?.isActive
                  ? `Are you sure you want to deactivate ${user?.firstName} ${user?.lastName}? They will no longer be able to log in or take workflow actions.`
                  : `Are you sure you want to activate ${user?.firstName} ${user?.lastName}? Their account will be restored to active status.`}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleActive}
                  disabled={isUpdating}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md text-white shadow-xs ${
                    user?.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {isUpdating ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
