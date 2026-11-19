import React from 'react';
import { Link } from 'react-router-dom';
import type { AttentionRequestItem } from '../../services/api';

interface AttentionRequestCardProps {
  item: AttentionRequestItem;
  onOpenSummary: (item: AttentionRequestItem) => void;
}

export const AttentionRequestCard: React.FC<AttentionRequestCardProps> = ({
  item,
  onOpenSummary,
}) => {
  const levelStyles = {
    CRITICAL: {
      border: 'border-red-300',
      bg: 'bg-red-50/20',
      badge: 'bg-red-100 text-red-800 border-red-200',
      dot: 'bg-red-600',
      label: 'CRITICAL',
    },
    HIGH: {
      border: 'border-amber-300',
      bg: 'bg-amber-50/20',
      badge: 'bg-amber-100 text-amber-900 border-amber-200',
      dot: 'bg-amber-600',
      label: 'HIGH',
    },
    MEDIUM: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/15',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      dot: 'bg-blue-600',
      label: 'MEDIUM',
    },
    NORMAL: {
      border: 'border-slate-200',
      bg: 'bg-white',
      badge: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
      label: 'NORMAL',
    },
  }[item.attentionLevel];

  const slaBadgeStyles = {
    OVERDUE: 'bg-red-50 text-red-700 border-red-200 font-bold',
    DUE_SOON: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    ON_TRACK: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    UNCONFIGURED: 'bg-slate-50 text-slate-500 border-slate-200',
  }[item.slaStatus];

  return (
    <div
      className={`p-4 rounded-xl border ${levelStyles.border} ${levelStyles.bg} transition-all hover:shadow-xs text-left`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${levelStyles.badge}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${levelStyles.dot}`} />
              {levelStyles.label}
            </span>
            <span className="text-xs font-bold text-slate-700 font-mono">
              {item.referenceNumber}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {item.category}
            </span>
            {item.isStuck && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                Stuck
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
            {item.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Department: <strong className="text-slate-700">{item.departmentName}</strong>
            {item.submittedAt && (
              <span> • Submitted: {new Date(item.submittedAt).toLocaleDateString()}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-start">
          <button
            type="button"
            onClick={() => onOpenSummary(item)}
            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI Summary
          </button>
          <Link
            to={`/request/${item.id}`}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Open Request →
          </Link>
        </div>
      </div>

      {/* Structured Details Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3 text-xs">
        <div className="p-2 bg-slate-50/75 rounded border border-slate-200/80">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">
            Current Stage
          </span>
          <span className="font-bold text-slate-800 truncate block mt-0.5">
            {item.currentStageName}
          </span>
        </div>
        <div className="p-2 bg-slate-50/75 rounded border border-slate-200/80">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">
            Assigned Reviewer
          </span>
          <span className="font-medium text-slate-700 truncate block mt-0.5">
            {item.currentApproverDisplay}
          </span>
        </div>
        <div className="p-2 bg-slate-50/75 rounded border border-slate-200/80">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">
            Stage Wait Time
          </span>
          <span className="font-bold text-slate-800 block mt-0.5">
            {item.timeAtCurrentStageFormatted}
          </span>
        </div>
        <div className="p-2 bg-slate-50/75 rounded border border-slate-200/80">
          <span className="text-[10px] text-slate-400 block font-semibold uppercase">
            SLA Status
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border inline-block mt-0.5 truncate max-w-full ${slaBadgeStyles}`}
          >
            {item.slaStatus === 'OVERDUE' ? 'Overdue' : item.slaStatus === 'DUE_SOON' ? 'Due Soon' : 'On Track'}
          </span>
        </div>
      </div>

      {/* Attention Reason Banner */}
      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <span className="font-bold text-slate-800">Reason for Attention: </span>
          <span>{item.attentionReason}</span>
          {item.slaDetails && item.slaStatus !== 'ON_TRACK' && (
            <span className="text-slate-500 block text-[11px] mt-0.5">
              Detail: {item.slaDetails}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
