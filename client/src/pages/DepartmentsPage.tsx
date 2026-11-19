import { useState, useEffect, useCallback, useMemo, type FC } from 'react';
import { api, type DepartmentItem, type UserItem } from '../services/api';
import { AppShell } from '../components/AppShell';
import { AdminNav } from '../components/AdminNav';
import { DepartmentToolbar } from '../components/DepartmentToolbar';
import { DepartmentTable } from '../components/DepartmentTable';
import { DepartmentModal } from '../components/DepartmentModal';
import { DepartmentStatusModal } from '../components/DepartmentStatusModal';

export const DepartmentsPage: FC = () => {
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal States
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentItem | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTargetDepartment, setStatusTargetDepartment] = useState<DepartmentItem | null>(null);

  // Toast / Feedback State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  // Fetch all departments
  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getDepartments();
      setDepartments(res.data || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load departments.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch users for HOD dropdown
  const fetchUsers = useCallback(async () => {
    try {
      setIsUsersLoading(true);
      const res = await api.getUsers();
      setUsers(res.data || []);
    } catch {
      // Silently tolerate user fetch failure if offline/unauthorized
    } finally {
      setIsUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, [fetchDepartments, fetchUsers]);

  // Filtering Logic
  const filteredDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return departments.filter((dept) => {
      // Status filter
      if (statusFilter === 'active' && !dept.isActive) return false;
      if (statusFilter === 'inactive' && dept.isActive) return false;

      // Search filter
      if (q) {
        const matchesName = dept.name.toLowerCase().includes(q);
        const matchesCode = dept.code.toLowerCase().includes(q);
        const matchesDisplay = dept.displayName?.toLowerCase().includes(q);
        const matchesHod = dept.hod
          ? `${dept.hod.firstName} ${dept.hod.lastName}`.toLowerCase().includes(q)
          : false;

        return matchesName || matchesCode || matchesDisplay || matchesHod;
      }

      return true;
    });
  }, [departments, search, statusFilter]);

  // Clear filters handler
  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(search || statusFilter !== 'all');

  // Paginated records
  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDepartments.slice(start, start + pageSize);
  }, [filteredDepartments, page, pageSize]);

  // Action handlers
  const handleOpenCreateModal = () => {
    setSelectedDepartment(null);
    setModalMode('create');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (dept: DepartmentItem) => {
    setSelectedDepartment(dept);
    setModalMode('edit');
    setIsFormModalOpen(true);
  };

  const handleOpenAssignHodModal = (dept: DepartmentItem) => {
    setSelectedDepartment(dept);
    setModalMode('edit');
    setIsFormModalOpen(true);
  };

  const handleOpenStatusModal = (dept: DepartmentItem) => {
    setStatusTargetDepartment(dept);
    setIsStatusModalOpen(true);
  };

  const handleOperationSuccess = (message: string) => {
    showToast(message, 'success');
    fetchDepartments();
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

      {/* Page Heading & Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Departments
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure hospital departments, heads of department and routing scopes
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="h-10 px-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white text-xs sm:text-sm font-semibold rounded-md shadow-2xs transition-colors whitespace-nowrap inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Create department</span>
        </button>
      </div>

      {/* Department Toolbar */}
      <DepartmentToolbar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Department Table */}
      <DepartmentTable
        departments={paginatedDepartments}
        isLoading={isLoading}
        error={error}
        onRetry={fetchDepartments}
        onEdit={handleOpenEditModal}
        onAssignHod={handleOpenAssignHodModal}
        onToggleStatus={handleOpenStatusModal}
        page={page}
        pageSize={pageSize}
        totalCount={filteredDepartments.length}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Create / Edit Department Modal */}
      <DepartmentModal
        isOpen={isFormModalOpen}
        mode={modalMode}
        department={selectedDepartment}
        existingDepartments={departments}
        users={users}
        isUsersLoading={isUsersLoading}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={handleOperationSuccess}
      />

      {/* Activate / Deactivate Confirmation Modal */}
      <DepartmentStatusModal
        isOpen={isStatusModalOpen}
        department={statusTargetDepartment}
        onClose={() => setIsStatusModalOpen(false)}
        onSuccess={handleOperationSuccess}
      />
    </AppShell>
  );
};

export default DepartmentsPage;
