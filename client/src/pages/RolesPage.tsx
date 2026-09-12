import React, { useState, useEffect } from 'react';
import { api, type RoleItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Modal State
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await api.getRoles();
      setRoles(res.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load system roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    if (!editingRole) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setEditingRole(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingRole, isSubmitting]);

  const handleOpenEdit = (role: RoleItem) => {
    setEditingRole(role);
    setDisplayName(role.displayName);
    setDescription(role.description || '');
    setModalError(null);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.updateRole(editingRole.id, {
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      });
      setSuccessMessage(`Role "${editingRole.code}" display label updated.`);
      setEditingRole(null);
      await fetchRoles();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to update role');
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
      <div className="roles-page max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Roles</h1>
            <p className="text-slate-500 mt-1">
              Configure user-facing display names and role descriptions. System codes remain immutable for workflow stability.
            </p>
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-md border border-red-200">
            ✕ {error}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading system roles..." />
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <th className="px-5 py-3">Role Code</th>
                  <th className="px-5 py-3">Display Name</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-indigo-700">
                      {r.code}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900">
                      {r.displayName}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 max-w-xs truncate">
                      {r.description || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.isSystem ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          System Built-in
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-slate-700">
                      {r._count?.users || 0}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors"
                      >
                        Edit Label
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* EDIT ROLE MODAL */}
        {editingRole && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => { if (!isSubmitting) setEditingRole(null); }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="role-modal-title"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 id="role-modal-title" className="text-base font-bold text-slate-900">Edit Role Display Name</h3>
                  <span className="text-xs font-mono font-bold text-indigo-600 uppercase">{editingRole.code}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
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

              <form onSubmit={handleSaveRole} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Custom Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This label will be shown across user forms, approval steps, and listings.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the responsibilities and scope of this role..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Label'}
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
