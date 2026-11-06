import { useState, useEffect } from 'react';
import { useTerminology } from '../context/TerminologyContext';

interface DataFilterBarProps {
  onFilterChange: (filters: { search: string; status: string; type: string }) => void;
}

export function DataFilterBar({ onFilterChange }: DataFilterBarProps) {
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFilterChange({ search, status, type });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, status, type]);

  const handleClear = () => {
    setSearch('');
    setStatus('');
    setType('');
  };

  const hasActiveFilters = Boolean(search || status || type);

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs border border-slate-200/90 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      {/* Search Input */}
      <div className="flex-1 w-full relative">
        <svg 
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          type="text" 
          placeholder="Search by reference ID or title..." 
          aria-label="Search requests by ID or Title"
          className="w-full h-[38px] pl-9 pr-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 transition-all duration-150"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      {/* Status Filter */}
      <div className="relative w-full sm:w-auto min-w-[150px]">
        <select 
          className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 transition-all duration-150 cursor-pointer"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by request status"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">{getStatusLabel('DRAFT')}</option>
          <option value="SUBMITTED">{getStatusLabel('SUBMITTED')}</option>
          <option value="IN_REVIEW">{getStatusLabel('IN_REVIEW')}</option>
          <option value="APPROVED">{getStatusLabel('APPROVED')}</option>
          <option value="REJECTED">{getStatusLabel('REJECTED')}</option>
          <option value="RETURNED">{getStatusLabel('RETURNED')}</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Type Filter */}
      <div className="relative w-full sm:w-auto min-w-[170px]">
        <select 
          className="w-full h-[38px] appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 text-sm text-slate-700 focus:outline-none focus:border-[#2457A7] focus:ring-2 focus:ring-[#2457A7]/15 transition-all duration-150 cursor-pointer"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by request type"
        >
          <option value="">All Request Types</option>
          <option value="PURCHASE">{getRequestTypeLabel('PURCHASE')}</option>
          <option value="MAINTENANCE">{getRequestTypeLabel('MAINTENANCE')}</option>
          <option value="LEAVE">{getRequestTypeLabel('LEAVE')}</option>
          <option value="GENERAL">{getRequestTypeLabel('GENERAL')}</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Clear Filters Action */}
      {hasActiveFilters && (
        <button 
          type="button"
          onClick={handleClear}
          className="h-[38px] px-3.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all duration-150 whitespace-nowrap flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7]"
          aria-label="Reset all search and filter criteria"
        >
          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}
