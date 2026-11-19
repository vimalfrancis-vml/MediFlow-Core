import React from 'react';
import type { DailyBriefingData } from '../../services/api';

interface DailyBriefingProps {
  briefing: DailyBriefingData;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({ briefing }) => {
  const formattedDate = new Date(briefing.asOf).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white border border-blue-200/80 rounded-xl p-5 mb-6 shadow-xs ring-1 ring-blue-700/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shadow-2xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {briefing.title}
            </h2>
            <p className="text-[11px] text-slate-500">
              Administrative Request Landscape & Executive Overview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Data as of: <strong>{formattedDate}</strong></span>
        </div>
      </div>

      {/* Summary Narrative */}
      <p className="text-xs text-slate-700 leading-relaxed font-medium mb-4">
        {briefing.summary}
      </p>

      {/* Structured Key Signals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending In Review</span>
          <span className="text-base font-bold text-slate-800">{briefing.totalPending}</span>
        </div>
        <div className="p-2.5 bg-red-50/50 rounded-lg border border-red-200">
          <span className="text-[10px] uppercase font-bold text-red-600 block">Critical Attention</span>
          <span className="text-base font-bold text-red-700">{briefing.criticalCount}</span>
        </div>
        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Highest Workload Dept</span>
          <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
            {briefing.highestWorkloadDepartment
              ? `${briefing.highestWorkloadDepartment.name} (${briefing.highestWorkloadDepartment.count})`
              : 'None'}
          </span>
        </div>
        <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Longest Stage Delay</span>
          <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
            {briefing.mostDelayedStage
              ? `${briefing.mostDelayedStage.name} (~${briefing.mostDelayedStage.avgHours}h)`
              : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
};
