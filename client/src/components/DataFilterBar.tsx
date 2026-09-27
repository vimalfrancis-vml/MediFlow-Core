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

  return (
    <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200/80 flex flex-col sm:flex-row gap-3 items-center">
      <div className="flex-1 w-full relative">
        <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          type="text" 
          placeholder="Search by reference ID or title..." 
          aria-label="Search requests by ID or Title"
          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-100 transition-all duration-150"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <select 
        className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-100 transition-all duration-150"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        <option value="DRAFT">{getStatusLabel('DRAFT')}</option>
        <option value="IN_REVIEW">{getStatusLabel('IN_REVIEW')}</option>
        <option value="APPROVED">{getStatusLabel('APPROVED')}</option>
        <option value="REJECTED">{getStatusLabel('REJECTED')}</option>
        <option value="RETURNED">{getStatusLabel('RETURNED')}</option>
      </select>

      <select 
        className="w-full sm:w-auto bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-100 transition-all duration-150"
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

      {(search || status || type) && (
        <button 
          onClick={handleClear}
          className="w-full sm:w-auto px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-md transition-all duration-150"
        >
          Clear
        </button>
      )}
    </div>
  );
}
