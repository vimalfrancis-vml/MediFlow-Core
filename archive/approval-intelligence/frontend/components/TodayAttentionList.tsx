import React, { useState, useMemo } from 'react';
import type { AttentionRequestItem } from '../../services/api';
import { AttentionRequestCard } from './AttentionRequestCard';

interface TodayAttentionListProps {
  items: AttentionRequestItem[];
  selectedOverviewFilter: string | null;
  onOpenSummary: (item: AttentionRequestItem) => void;
}

export const TodayAttentionList: React.FC<TodayAttentionListProps> = ({
  items,
  selectedOverviewFilter,
  onOpenSummary,
}) => {
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Overview card quick filter
      if (selectedOverviewFilter === 'critical' && item.attentionLevel !== 'CRITICAL') return false;
      if (selectedOverviewFilter === 'overdue' && item.slaStatus !== 'OVERDUE') return false;
      if (selectedOverviewFilter === 'stuck' && !item.isStuck) return false;

      // 2. Level filter tab
      if (levelFilter !== 'ALL' && item.attentionLevel !== levelFilter) return false;

      // 3. Category filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRef = item.referenceNumber.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDept = item.departmentName.toLowerCase().includes(q);
        const matchesApprover = item.currentApproverDisplay.toLowerCase().includes(q);
        if (!matchesRef && !matchesTitle && !matchesDept && !matchesApprover) {
          return false;
        }
      }

      return true;
    });
  }, [items, selectedOverviewFilter, levelFilter, categoryFilter, searchQuery]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-xs">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Today's Attention List</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
              {filteredItems.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked administrative requisitions requiring oversight or intervention.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ref, title, dept..."
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
          />
        </div>
      </div>

      {/* Filter Tabs Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-xs">
        {/* Severity Level Filter */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'NORMAL'].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                levelFilter === lvl
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lvl === 'ALL' ? 'All Priority' : lvl}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white text-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="PURCHASE">Purchase</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="LEAVE">Leave</option>
            <option value="GENERAL">General</option>
          </select>
        </div>
      </div>

      {/* List Content */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <p className="font-semibold text-slate-700">No matching requests found</p>
          <p className="mt-1 text-[11px] text-slate-400">
            All requisitions within this filter criteria are operating within normal operational bounds.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredItems.map((item) => (
            <AttentionRequestCard
              key={item.id}
              item={item}
              onOpenSummary={onOpenSummary}
            />
          ))}
        </div>
      )}
    </div>
  );
};
