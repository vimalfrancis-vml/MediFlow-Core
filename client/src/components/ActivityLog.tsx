import React, { useState } from 'react';
import type { RequestItem } from '../services/api';
import { fmtDateTime, fmtSize } from '../utils/date';

interface ActivityLogProps {
  logs: NonNullable<RequestItem['auditLogs']>;
  className?: string;
}

const APPROVAL_ACTIONS = new Set([
  'APPROVED',
  'STEP_APPROVED',
  'REJECTED',
  'RETURNED',
  'FORWARDED',
  'ADMIN_OVERRIDE_STEP_APPROVAL',
  'ADMIN_OVERRIDE_REJECTION',
]);

const formatActionName = (action: string): string => {
  switch (action) {
    case 'CREATED':
      return 'Request created';
    case 'SUBMITTED':
      return 'Submitted for approval';
    case 'APPROVED':
      return 'Request fully approved';
    case 'STEP_APPROVED':
      return 'Step approved';
    case 'REJECTED':
      return 'Request rejected';
    case 'RETURNED':
      return 'Returned for revision';
    case 'FORWARDED':
      return 'Request reassigned';
    case 'CANCELLED':
      return 'Request cancelled';
    case 'DOCUMENT_UPLOADED':
      return 'Document uploaded';
    case 'COMMENTED':
      return 'Comment added';
    case 'ADMIN_OVERRIDE_STEP_APPROVAL':
      return 'Administrative override approval';
    case 'ADMIN_OVERRIDE_REJECTION':
      return 'Administrative override rejection';
    default:
      return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
};

const formatRole = (role?: string | null): string => {
  if (!role) return '';
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatActivityDescription = (desc?: string | null): string => {
  if (!desc) return '';
  return desc.replace(/\((\d+(?:\.\d+)?)\s*KB\)/gi, (_, kbStr) => {
    const kb = parseFloat(kbStr);
    return `(${fmtSize(kb * 1024)})`;
  });
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ logs, className = '' }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'approvals'>('all');

  const filteredLogs = activeTab === 'approvals'
    ? logs.filter((log) => APPROVAL_ACTIONS.has(log.action))
    : logs;

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'APPROVED':
      case 'STEP_APPROVED':
        return (
          <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        );
      case 'REJECTED':
      case 'ADMIN_OVERRIDE_REJECTION':
        return (
          <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        );
      case 'RETURNED':
        return (
          <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </div>
        );
      case 'FORWARDED':
        return (
          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        );
      case 'CREATED':
      case 'SUBMITTED':
        return (
          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        );
      case 'DOCUMENT_UPLOADED':
        return (
          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
        );
      case 'ADMIN_OVERRIDE_STEP_APPROVAL':
        return (
          <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          </div>
        );
    }
  };

  return (
    <section className={`bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`} aria-labelledby="activity-log-heading">
      {/* Standard Card Header: px-5 py-3 border-b border-slate-200 */}
      <div className="px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 id="activity-log-heading" className="text-sm font-semibold text-slate-900">
          Activity Log
        </h2>

        {/* Filter Tabs */}
        <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-md border border-slate-200/70" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All activity ({logs.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'approvals'}
            onClick={() => setActiveTab('approvals')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'approvals'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Approvals ({logs.filter((l) => APPROVAL_ACTIONS.has(l.action)).length})
          </button>
        </div>
      </div>

      {/* Standard Card Body: p-5 */}
      <div className="p-5">
        {filteredLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            {activeTab === 'approvals' ? 'No approval events recorded yet.' : 'No activity recorded yet.'}
          </div>
        ) : (
          <div className="relative pl-1">
            <ol className="relative space-y-4" role="list">
              {filteredLogs.map((log, index) => {
                const isLast = index === filteredLogs.length - 1;

                return (
                  <li key={log.id} className="relative flex items-start gap-3">
                    {!isLast && (
                      <span
                        className="absolute left-3 top-6 bottom-0 w-[1.5px] -mb-4 bg-slate-100"
                        aria-hidden="true"
                      />
                    )}

                    <div className="relative z-10 flex-shrink-0">
                      {getActionIcon(log.action)}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {formatActionName(log.action)}
                        </span>
                        <time
                          dateTime={log.timestamp}
                          className="text-xs text-slate-500 whitespace-nowrap flex-shrink-0"
                        >
                          {fmtDateTime(log.timestamp)}
                        </time>
                      </div>

                      {log.description && (
                        <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap leading-relaxed break-words">
                          {formatActivityDescription(log.description)}
                        </p>
                      )}

                      {/* Actor and Role: Actor · Role (No parentheses, no uppercase, no avatars) */}
                      {log.actor && (
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="text-slate-900 font-medium">{log.actor.firstName} {log.actor.lastName}</span>
                          <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
                          <span>{formatRole(log.actor.role)}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
};
