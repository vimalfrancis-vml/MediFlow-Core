import { useState, useEffect, useCallback, useMemo, type FC } from 'react';
import { api, type RoleItem } from '../services/api';
import { AppShell } from '../components/AppShell';
import { AdminNav } from '../components/AdminNav';
import { RoleToolbar } from '../components/RoleToolbar';
import { RoleTable } from '../components/RoleTable';
import { EditRoleModal } from '../components/EditRoleModal';

export const RolesPage: FC = () => {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'builtin' | 'custom'>('all');

  // Modal State
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);

  // Toast / Feedback State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Fetch all roles
  const fetchRoles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getRoles();
      setRoles(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load roles.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Filtering Logic
  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roles.filter((role) => {
      // Type filter
      if (typeFilter === 'builtin' && !role.isSystem) return false;
      if (typeFilter === 'custom' && role.isSystem) return false;

      // Search filter
      if (q) {
        const matchesCode = role.code.toLowerCase().includes(q);
        const matchesName = role.displayName.toLowerCase().includes(q);
        const matchesDesc = role.description?.toLowerCase().includes(q);
        return matchesCode || matchesName || Boolean(matchesDesc);
      }

      return true;
    });
  }, [roles, search, typeFilter]);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
  }, []);

  const hasActiveFilters = Boolean(search || typeFilter !== 'all');

  const handleSuccess = (message: string) => {
    showToast(message, 'success');
    fetchRoles();
  };

  return (
    <AppShell role="ADMIN" nav={<AdminNav />}>
      {/* Toast Feedback Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 flex items-center justify-between text-xs font-medium shadow-xs transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-rose-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Roles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure display names and descriptions. System codes are immutable to protect workflow stability.
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <RoleToolbar
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Role Table */}
      <RoleTable
        roles={filteredRoles}
        isLoading={isLoading}
        error={error}
        onRetry={fetchRoles}
        onEdit={(role) => setEditingRole(role)}
        totalRoles={roles.length}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Edit Role Modal */}
      <EditRoleModal
        isOpen={Boolean(editingRole)}
        role={editingRole}
        onClose={() => setEditingRole(null)}
        onSuccess={handleSuccess}
      />
    </AppShell>
  );
};

export default RolesPage;
