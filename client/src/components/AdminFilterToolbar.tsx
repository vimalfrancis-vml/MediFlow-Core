import type { FC } from 'react';
import type { DepartmentItem } from '../services/api';
import { useTerminology } from '../context/TerminologyContext';

export interface AdminFilterToolbarProps {
  search: string;
  onSearchChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  type: string;
  onTypeChange: (val: string) => void;
  department: string;
  onDepartmentChange: (val: string) => void;
  departments: DepartmentItem[];
  startDate: string;
  onStartDateChange: (val: string) => void;
  endDate: string;
  onEndDateChange: (val: string) => void;
  hasActiveFilters: boolean;
  onClear: () => void;
}

export const AdminFilterToolbar: FC<AdminFilterToolbarProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  department,
  onDepartmentChange,
  departments,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  hasActiveFilters,
  onClear,
}) => {
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
      {/* Primary Row: Search and primary dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
        {/* Search Input: Reference ID and Title */}
        <div className="lg:col-span-4 relative">
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
            placeholder="Search by reference ID or title..."
            aria-label="Search requests by reference ID or title"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors"
          />
        </div>

        {/* Status Dropdown */}
        <div className="lg:col-span-3">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Filter by status"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors cursor-pointer"
          >
            <option value="">All statuses</option>
            <option value="IN_REVIEW">{getStatusLabel('IN_REVIEW')}</option>
            <option value="APPROVED">{getStatusLabel('APPROVED')}</option>
            <option value="REJECTED">{getStatusLabel('REJECTED')}</option>
            <option value="RETURNED">{getStatusLabel('RETURNED')}</option>
            <option value="DRAFT">{getStatusLabel('DRAFT')}</option>
            <option value="CANCELLED">{getStatusLabel('CANCELLED')}</option>
          </select>
        </div>

        {/* Request Type Dropdown */}
        <div className="lg:col-span-3">
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            aria-label="Filter by request type"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors cursor-pointer"
          >
            <option value="">All request types</option>
            <option value="PURCHASE">{getRequestTypeLabel('PURCHASE')}</option>
            <option value="MAINTENANCE">{getRequestTypeLabel('MAINTENANCE')}</option>
            <option value="LEAVE">{getRequestTypeLabel('LEAVE')}</option>
            <option value="GENERAL">{getRequestTypeLabel('GENERAL')}</option>
          </select>
        </div>

        {/* Department Dropdown */}
        <div className="lg:col-span-2">
          <select
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            aria-label="Filter by department"
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors cursor-pointer truncate"
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.displayName || dept.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secondary Row: Date Range & Clear Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
            Date range:
          </span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Filter start date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors"
            />
            <span className="text-slate-400 text-xs font-medium">to</span>
            <input
              type="date"
              aria-label="Filter end date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="h-10 px-4 self-end sm:self-auto rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Clear filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
