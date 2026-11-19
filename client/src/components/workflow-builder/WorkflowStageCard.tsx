import React from 'react';
import type { VisualNode } from './workflowAdapter';

interface WorkflowStageCardProps {
  node: VisualNode;
  isSelected: boolean;
  approvalIndex?: number;
  totalApprovalStages?: number;
  readOnly?: boolean;
  onSelect: (node: VisualNode) => void;
  onMoveUp?: (approvalIndex: number) => void;
  onMoveDown?: (approvalIndex: number) => void;
  onDelete?: (approvalIndex: number) => void;
}

export const WorkflowStageCard: React.FC<WorkflowStageCardProps> = ({
  node,
  isSelected,
  approvalIndex = 0,
  totalApprovalStages = 1,
  readOnly = false,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
}) => {
  if (node.kind === 'START') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node);
          }
        }}
        className={`w-full max-w-xl mx-auto p-4 rounded-xl border transition-all text-left cursor-pointer ${
          isSelected
            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20 shadow-xs'
            : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{node.stepName}</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Initial Entry
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hospital staff originates and submits the requisition form.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-400">Display Only</span>
        </div>
      </div>
    );
  }

  if (node.kind === 'END') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node);
          }
        }}
        className={`w-full max-w-xl mx-auto p-4 rounded-xl border transition-all text-left cursor-pointer ${
          isSelected
            ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20 shadow-xs'
            : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{node.stepName}</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Terminal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Workflow completes; request transitions to Approved state.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-slate-400">Display Only</span>
        </div>
      </div>
    );
  }

  // APPROVAL STAGE NODE
  const canMoveUp = !readOnly && approvalIndex > 0;
  const canMoveDown = !readOnly && approvalIndex < totalApprovalStages - 1;
  const canDelete = !readOnly && totalApprovalStages > 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(node)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node);
        }
      }}
      className={`w-full max-w-xl mx-auto p-4 rounded-xl border transition-all text-left cursor-pointer ${
        isSelected
          ? 'border-blue-700 bg-blue-50/40 ring-2 ring-blue-700/20 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Order Badge & Stage Info */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs mt-0.5">
            {node.order}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 truncate">{node.stepName}</h4>
              {node.isFinal && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
                  Final Decision
                </span>
              )}
              {node.isAutomatic && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-50 text-purple-700 border border-purple-200">
                  Automatic Rule
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-600">
              <span className="font-semibold text-blue-700">
                Role: {node.approverRole.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                Scope: {node.approverDepartmentName || 'Any Department'}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[11px]">
              <span
                className={`font-medium flex items-center gap-1 ${
                  node.allowDynamicForwarding ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {node.allowDynamicForwarding ? '✓ Forwarding Allowed' : '✕ Fixed Role Assignment'}
              </span>
            </div>

            {node.ruleNotice && (
              <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 flex items-start gap-1.5">
                <span className="text-blue-700 font-bold">ℹ</span>
                <span>{node.ruleNotice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Stage Controls (Move Up, Move Down, Delete) */}
        {!readOnly && (
          <div
            className="flex items-center gap-1 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMoveUp && onMoveUp(approvalIndex)}
              aria-label={`Move stage "${node.stepName}" up`}
              className={`p-1.5 rounded border text-xs transition-colors ${
                canMoveUp
                  ? 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50/50'
              }`}
              title="Move Up"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMoveDown && onMoveDown(approvalIndex)}
              aria-label={`Move stage "${node.stepName}" down`}
              className={`p-1.5 rounded border text-xs transition-colors ${
                canMoveDown
                  ? 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  : 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50/50'
              }`}
              title="Move Down"
            >
              ▼
            </button>
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => onDelete && onDelete(approvalIndex)}
              aria-label={`Delete stage "${node.stepName}"`}
              className={`p-1.5 rounded border text-xs transition-colors ml-1 ${
                canDelete
                  ? 'border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200'
                  : 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50/50'
              }`}
              title="Delete Stage"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
