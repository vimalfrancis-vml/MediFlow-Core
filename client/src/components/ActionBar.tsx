import React from 'react';
import type { DecisionActionType } from './DecisionModal';

interface ActionBarProps {
  canAct: boolean;
  isActionLoading: boolean;
  onSelectAction: (action: DecisionActionType) => void;
  className?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  canAct,
  isActionLoading,
  onSelectAction,
  className = '',
}) => {
  if (!canAct) return null;

  return (
    <nav
      className={`sticky top-0 z-20 bg-white border-b border-slate-200 shadow-2xs w-full ${className}`}
      aria-label="Approval review actions"
    >
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Approve — solid emerald-700 */}
          <button
            type="button"
            id="btn-approve"
            disabled={isActionLoading}
            onClick={() => onSelectAction('approve')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 rounded-md shadow-2xs transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Approve</span>
          </button>

          {/* 2. Return for changes — outlined */}
          <button
            type="button"
            id="btn-return"
            disabled={isActionLoading}
            onClick={() => onSelectAction('return')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            <svg
              className="w-4 h-4 text-slate-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Return for changes</span>
          </button>

          {/* 3. Reject — solid rose-700 */}
          <button
            type="button"
            id="btn-reject"
            disabled={isActionLoading}
            onClick={() => onSelectAction('reject')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 rounded-md shadow-2xs transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700"
          >
            <svg
              className="w-4 h-4 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span>Reject</span>
          </button>

          {/* 4. Reassign — outlined and right-aligned on desktop */}
          <button
            type="button"
            id="btn-reassign"
            disabled={isActionLoading}
            onClick={() => onSelectAction('reassign')}
            className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors disabled:opacity-50 sm:ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <svg
              className="w-4 h-4 text-slate-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <circle cx="19" cy="11" r="2" />
              <path d="M19 8v1" />
              <path d="M19 13v1" />
              <path d="m21.6 9.5-.87.5" />
              <path d="m17.27 12-.87.5" />
              <path d="m21.6 12.5-.87-.5" />
              <path d="m17.27 10-.87-.5" />
            </svg>
            <span>Reassign</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
