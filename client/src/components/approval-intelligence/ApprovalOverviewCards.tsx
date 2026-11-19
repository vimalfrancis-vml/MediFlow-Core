import React from 'react';
import type { IntelligenceOverviewData } from '../../services/api';

interface ApprovalOverviewCardsProps {
  overview: IntelligenceOverviewData;
  activeFilter: string | null;
  onSelectFilter: (filterKey: string | null) => void;
}

export const ApprovalOverviewCards: React.FC<ApprovalOverviewCardsProps> = ({
  overview,
  activeFilter,
  onSelectFilter,
}) => {
  const cards = [
    {
      key: 'today',
      title: 'Received Today',
      value: overview.requestsReceivedToday,
      description: 'Submitted during current day',
      borderColor: 'border-blue-200',
      activeRing: 'ring-2 ring-blue-600',
      textColor: 'text-blue-700',
      bgColor: 'bg-blue-50/50',
      badge: 'Today',
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      key: 'pending',
      title: 'Total Pending',
      value: overview.totalPendingRequests,
      description: 'Currently in review pipeline',
      borderColor: 'border-slate-200',
      activeRing: 'ring-2 ring-slate-600',
      textColor: 'text-slate-800',
      bgColor: 'bg-white',
      badge: 'In Review',
      badgeColor: 'bg-slate-100 text-slate-700',
    },
    {
      key: 'critical',
      title: 'Critical Attention',
      value: overview.criticalAttentionRequests,
      description: 'Emergency, stuck, or severe delay',
      borderColor: 'border-red-200',
      activeRing: 'ring-2 ring-red-600',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50/40',
      badge: 'Action Needed',
      badgeColor: 'bg-red-100 text-red-800',
    },
    {
      key: 'overdue',
      title: 'Overdue Approvals',
      value: overview.overdueApprovals,
      description: 'Exceeded SLA review threshold',
      borderColor: 'border-amber-200',
      activeRing: 'ring-2 ring-amber-600',
      textColor: 'text-amber-800',
      bgColor: 'bg-amber-50/40',
      badge: 'Threshold Breach',
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    {
      key: 'stuck',
      title: 'Potentially Stuck',
      value: overview.potentiallyStuckRequests,
      description: 'Missing or inactive approver',
      borderColor: 'border-purple-200',
      activeRing: 'ring-2 ring-purple-600',
      textColor: 'text-purple-700',
      bgColor: 'bg-purple-50/40',
      badge: 'Routing Alert',
      badgeColor: 'bg-purple-100 text-purple-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((c) => {
        const isSelected = activeFilter === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelectFilter(isSelected ? null : c.key)}
            className={`p-4 rounded-xl border ${c.borderColor} ${c.bgColor} text-left transition-all hover:shadow-xs focus:outline-none ${
              isSelected ? c.activeRing : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 truncate">{c.title}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.badgeColor}`}>
                {c.badge}
              </span>
            </div>
            <div className={`text-2xl font-bold tracking-tight ${c.textColor}`}>
              {c.value.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">{c.description}</p>
          </button>
        );
      })}
    </div>
  );
};
