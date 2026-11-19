import type { FC, MouseEvent } from 'react';
import type { RoleItem } from '../services/api';
import { BuiltInChip } from './BuiltInChip';

export interface RoleTableProps {
  roles: RoleItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (role: RoleItem) => void;
  totalRoles: number;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export const RoleTable: FC<RoleTableProps> = ({
  roles,
  isLoading,
  error,
  onRetry,
  onEdit,
  totalRoles,
  hasActiveFilters = false,
  onClearFilters,
}) => {
  // Loading skeleton state
  if (isLoading && roles.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full table-fixed text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="h-10 text-xs font-semibold text-slate-600">
                <th className="w-56 px-4 py-2.5">Role code</th>
                <th className="w-56 px-4 py-2.5">Display name</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="w-28 px-4 py-2.5">Type</th>
                <th className="w-24 px-4 py-2.5 text-right">Users</th>
                <th className="w-20 px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="h-12 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-36" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-slate-200 rounded w-16" /></td>
                  <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-8 ml-auto" /></td>
                  <td className="px-4 py-3 text-right"><div className="h-7 bg-slate-200 rounded w-12 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Error state
  if (error && roles.length === 0) {
    return (
      <div className="rounded-lg border border-rose-200 bg-white p-8 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">Unable to load roles.</p>
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
  if (roles.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">No roles found</p>
        <p className="text-xs text-slate-500 mb-4">No system or custom roles match your current search criteria.</p>
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
        <table className="min-w-[860px] w-full table-fixed text-left text-sm border-collapse">
          {/* Table Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="h-10 text-xs font-semibold text-slate-600">
              <th scope="col" className="w-56 px-4 py-2.5">Role code</th>
              <th scope="col" className="w-56 px-4 py-2.5">Display name</th>
              <th scope="col" className="px-4 py-2.5">Description</th>
              <th scope="col" className="w-28 px-4 py-2.5">Type</th>
              <th scope="col" className="w-24 px-4 py-2.5 text-right">Users</th>
              <th scope="col" className="w-20 px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {roles.map((role) => {
              const userCount = role._count?.users ?? 0;

              return (
                <tr
                  key={role.id}
                  className="h-12 hover:bg-slate-50 transition-colors duration-150"
                >
                  {/* Column 1: Role code with lock icon */}
                  <td className="px-4 py-2.5 align-middle">
                    <div
                      className="inline-flex items-center gap-1.5"
                      title="System code cannot be changed"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <span className="font-mono text-xs font-semibold text-slate-700 tracking-tight select-all">
                        {role.code}
                      </span>
                    </div>
                  </td>

                  {/* Column 2: Display name */}
                  <td className="px-4 py-2.5 align-middle">
                    <span
                      className="text-sm font-medium text-slate-900 truncate block whitespace-nowrap"
                      title={role.displayName}
                    >
                      {role.displayName}
                    </span>
                  </td>

                  {/* Column 3: Description */}
                  <td className="px-4 py-2.5 align-middle">
                    <span
                      className="text-sm text-slate-600 truncate block max-w-md"
                      title={role.description || undefined}
                    >
                      {role.description || '—'}
                    </span>
                  </td>

                  {/* Column 4: Type (BuiltInChip) */}
                  <td className="px-4 py-2.5 align-middle">
                    <BuiltInChip isSystem={role.isSystem} />
                  </td>

                  {/* Column 5: Users */}
                  <td className="px-4 py-2.5 align-middle text-right">
                    <span
                      className="text-sm tabular-nums text-slate-800 font-medium"
                      title={`${userCount} user(s) assigned to ${role.displayName}`}
                    >
                      {userCount}
                    </span>
                  </td>

                  {/* Column 6: Actions (Edit ghost button) */}
                  <td className="px-4 py-2.5 align-middle text-right">
                    <button
                      type="button"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        onEdit(role);
                      }}
                      aria-label={`Edit role ${role.code}`}
                      className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-blue-700 hover:bg-slate-100 rounded transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
        <span>
          Showing <strong className="font-semibold text-slate-900">{roles.length}</strong>{' '}
          {hasActiveFilters && roles.length !== totalRoles ? (
            <>of <strong className="font-semibold text-slate-900">{totalRoles}</strong> </>
          ) : null}
          {roles.length === 1 ? 'role' : 'roles'}
        </span>
      </div>
    </div>
  );
};

