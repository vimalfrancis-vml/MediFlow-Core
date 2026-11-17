import type { FC } from 'react';

export interface RoleToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: 'all' | 'builtin' | 'custom';
  onTypeFilterChange: (value: 'all' | 'builtin' | 'custom') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export const RoleToolbar: FC<RoleToolbarProps> = ({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  hasActiveFilters,
  onClearFilters,
}) => {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search roles by code or display name..."
            aria-label="Search roles by code or display name"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors"
          />
        </div>

        {/* Type Filter */}
        <div className="w-full sm:w-44">
          <select
            value={typeFilter}
            onChange={(e) =>
              onTypeFilterChange(e.target.value as 'all' | 'builtin' | 'custom')
            }
            aria-label="Filter by role type"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors cursor-pointer"
          >
            <option value="all">All roles</option>
            <option value="builtin">Built-in</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="h-10 px-3.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Clear filters</span>
        </button>
      )}
    </div>
  );
};

