import React from 'react';
import { Link } from 'react-router-dom';
import type { BottlenecksData } from '../../services/api';

interface BottlenecksPanelProps {
  bottlenecks: BottlenecksData;
}

export const BottlenecksPanel: React.FC<BottlenecksPanelProps> = ({ bottlenecks }) => {
  const maxDeptCount = Math.max(...bottlenecks.byDepartment.map((d) => d.pendingCount), 1);
  const maxStageWait = Math.max(...bottlenecks.byStage.map((s) => s.avgWaitHours), 1);

  return (
    <div className="space-y-6">
      {/* 2-Column: Department & Category Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Department Bottlenecks */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pending by Department</h3>
              <p className="text-[11px] text-slate-500">Departmental review volume</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {bottlenecks.byDepartment.length} Depts
            </span>
          </div>

          <div className="space-y-3">
            {bottlenecks.byDepartment.map((dept) => {
              const pct = Math.round((dept.pendingCount / maxDeptCount) * 100);
              return (
                <div key={dept.departmentCode} className="text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-700 truncate">
                      {dept.departmentName}
                    </span>
                    <span className="font-bold text-slate-900">{dept.pendingCount}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-700 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pending by Category</h3>
              <p className="text-[11px] text-slate-500">Active requisition types</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {bottlenecks.byCategory.map((cat) => (
              <div
                key={cat.category}
                className="p-3 bg-slate-50/75 rounded-lg border border-slate-200 text-left"
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {cat.category}
                </span>
                <span className="text-xl font-bold text-slate-800 block mt-0.5">
                  {cat.pendingCount}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  pending approvals
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow Stage Waiting Times */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Workflow Stage Duration Analysis
            </h3>
            <p className="text-[11px] text-slate-500">
              Average waiting time per approval stage across in-review requests
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {bottlenecks.byStage.map((stg) => {
            const pct = Math.round((stg.avgWaitHours / maxStageWait) * 100);
            return (
              <div key={stg.stageName} className="text-xs">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-800 truncate">{stg.stageName}</span>
                    <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-semibold">
                      {stg.approverRole.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-[11px]">
                    <span className="text-slate-500">{stg.pendingCount} req(s)</span>
                    <span className="font-bold text-slate-900">~{stg.avgWaitHours} hrs avg</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stuck / Unassigned Requests Table */}
      {bottlenecks.stuckRequests.length > 0 && (
        <div className="bg-white border border-purple-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-bold text-purple-900">
                  Potentially Stuck Requests ({bottlenecks.stuckRequests.length})
                </h3>
                <p className="text-[11px] text-purple-700">
                  Requisitions where no active eligible approver can currently act
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2 pr-3">Ref</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Stage</th>
                  <th className="py-2 pr-3">Root Cause</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bottlenecks.stuckRequests.map((stk) => (
                  <tr key={stk.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-3 font-mono font-bold text-slate-800">
                      {stk.referenceNumber}
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900 truncate max-w-xs">
                      {stk.title}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{stk.departmentName}</td>
                    <td className="py-2.5 pr-3 font-semibold text-blue-700">{stk.currentStageName}</td>
                    <td className="py-2.5 pr-3 text-purple-800 font-medium">
                      {stk.stuckReason || 'No eligible active reviewer'}
                    </td>
                    <td className="py-2.5 text-right">
                      <Link
                        to={`/request/${stk.id}`}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLA Policy Baseline Notice */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
        <svg className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <strong className="text-slate-800">SLA Baseline Configuration: </strong>
          <span>{bottlenecks.slaNotice}</span>
        </div>
      </div>
    </div>
  );
};
