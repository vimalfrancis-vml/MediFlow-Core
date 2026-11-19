import { useState, useRef, useEffect, type FC, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DepartmentItem } from '../services/api';
import { ActiveChip } from './ActiveChip';

export interface DepartmentTableProps {
  departments: DepartmentItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (dept: DepartmentItem) => void;
  onAssignHod: (dept: DepartmentItem) => void;
  onToggleStatus: (dept: DepartmentItem) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export const DepartmentTable: FC<DepartmentTableProps> = ({
  departments,
  isLoading,
  error,
  onRetry,
  onEdit,
  onAssignHod,
  onToggleStatus,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  hasActiveFilters = false,
  onClearFilters,
}) => {
  const navigate = useNavigate();
  const [activeMenuDeptId, setActiveMenuDeptId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close action menu on click outside or Escape
  useEffect(() => {
    if (!activeMenuDeptId) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuDeptId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuDeptId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuDeptId]);

  // Pagination bounds calculation
  const startItem = departments.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(startItem + departments.length - 1, totalCount);
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;

  // Loading skeleton state
  if (isLoading && departments.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full table-fixed text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="h-10 text-xs font-semibold text-slate-600">
                <th className="w-64 px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Head of department</th>
                <th className="w-28 px-4 py-2.5 text-right">Employees</th>
                <th className="w-32 px-4 py-2.5 text-right">Open requests</th>
                <th className="w-28 px-4 py-2.5">Status</th>
                <th className="w-28 px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="h-12 animate-pulse">
                  <td className="px-4 py-3">
                    <div className="h-4 bg-slate-200 rounded w-36 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-16" />
                  </td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                  <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-10 ml-auto" /></td>
                  <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-10 ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-slate-200 rounded w-16" /></td>
                  <td className="px-4 py-3 text-right"><div className="h-6 bg-slate-200 rounded w-14 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Error state
  if (error && departments.length === 0) {
    return (
      <div className="rounded-lg border border-rose-200 bg-white p-8 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">Unable to load departments.</p>
        <p className="text-xs text-rose-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="h-10 px-4 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (departments.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">No departments found</p>
        <p className="text-xs text-slate-500 mb-4">No hospital departments match your current filter criteria.</p>
        {hasActiveFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="h-9 px-3.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-xs font-medium transition-colors shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col">
      <div className="overflow-x-auto">
        <table className="min-w-[820px] w-full table-fixed text-left text-sm border-collapse">
          {/* Table Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="h-10 text-xs font-semibold text-slate-600">
              <th scope="col" className="w-64 px-4 py-2.5">Department</th>
              <th scope="col" className="px-4 py-2.5">Head of department</th>
              <th scope="col" className="w-28 px-4 py-2.5 text-right">Employees</th>
              <th
                scope="col"
                className="w-32 px-4 py-2.5 text-right"
                title="Number of active workflow requests currently awaiting review in this department"
              >
                Open requests
              </th>
              <th scope="col" className="w-28 px-4 py-2.5">Status</th>
              <th scope="col" className="w-28 px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {departments.map((dept) => {
              const hodName = dept.hod ? `${dept.hod.firstName} ${dept.hod.lastName}`.trim() : null;
              const userCount = dept._count?.users ?? 0;
              const openRequests = dept._count?.requests ?? 0;
              const isMenuOpen = activeMenuDeptId === dept.id;

              return (
                <tr
                  key={dept.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View department ${dept.name} (${dept.code})`}
                  onClick={() => navigate(`/admin/departments/${dept.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/admin/departments/${dept.id}`);
                    }
                  }}
                  className="h-12 hover:bg-slate-50 cursor-pointer transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-[-2px] group"
                >
                  {/* Department Name & Code */}
                  <td className="px-4 py-2.5 align-middle">
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm font-medium text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                        {dept.displayName || dept.name}
                      </span>
                      <span className="font-mono text-xs text-slate-500 mt-0.5">
                        {dept.code}
                      </span>
                    </div>
                  </td>

                  {/* Head of Department (HOD) */}
                  <td className="px-4 py-2.5 align-middle">
                    {hodName ? (
                      <span className="text-sm text-slate-800 truncate block">
                        {hodName}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-700 font-medium">
                          Not assigned
                        </span>
                        <button
                          type="button"
                          onClick={(e: MouseEvent) => {
                            e.stopPropagation();
                            onAssignHod(dept);
                          }}
                          className="text-xs text-blue-700 hover:text-blue-800 hover:underline font-medium focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-700"
                        >
                          Assign
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Employee Count */}
                  <td className="px-4 py-2.5 align-middle text-right">
                    <span
                      className="text-sm tabular-nums text-slate-800 font-medium hover:text-blue-700 hover:underline"
                      title={`View ${userCount} employee(s) in ${dept.name}`}
                    >
                      {userCount}
                    </span>
                  </td>

                  {/* Open Requests Count */}
                  <td className="px-4 py-2.5 align-middle text-right">
                    <span
                      className={`text-sm tabular-nums font-medium ${
                        openRequests > 0 ? 'text-amber-800 font-semibold' : 'text-slate-600'
                      }`}
                      title={`${openRequests} active workflow request(s) currently under review`}
                    >
                      {openRequests}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5 align-middle">
                    <ActiveChip isActive={dept.isActive} />
                  </td>

                  {/* Actions Column */}
                  <td className="px-4 py-2.5 align-middle text-right relative">
                    <div
                      className="inline-flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Edit ghost button */}
                      <button
                        type="button"
                        onClick={() => onEdit(dept)}
                        aria-label={`Edit ${dept.name}`}
                        title="Edit department"
                        className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-700"
                      >
                        Edit
                      </button>

                      {/* More actions dropdown trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuDeptId(isMenuOpen ? null : dept.id)
                          }
                          aria-label={`More actions for ${dept.name}`}
                          aria-expanded={isMenuOpen}
                          aria-haspopup="true"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-700"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 mt-1 w-44 rounded-md bg-white border border-slate-200 shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-left"
                            role="menu"
                            aria-orientation="vertical"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveMenuDeptId(null);
                                onEdit(dept);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                              Edit details
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveMenuDeptId(null);
                                onAssignHod(dept);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                              Assign HOD
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveMenuDeptId(null);
                                onToggleStatus(dept);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                dept.isActive
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {dept.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="font-semibold text-slate-900">{startItem}–{endItem}</strong> of{' '}
            <strong className="font-semibold text-slate-900">{totalCount}</strong>
          </span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="dept-page-size-select" className="text-slate-500">
              Per page:
            </label>
            <select
              id="dept-page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Previous
          </button>
          <span className="text-slate-500 px-1">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

