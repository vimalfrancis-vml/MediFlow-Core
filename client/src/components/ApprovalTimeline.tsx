import React from 'react';
import type { RequestItem } from '../services/api';
import { fmtDateTime } from '../utils/date';

interface ApprovalTimelineProps {
  request: RequestItem;
  className?: string;
}

type StepState = 'COMPLETED' | 'CURRENT' | 'PENDING' | 'REJECTED' | 'RETURNED';

interface StepInfo {
  id?: string;
  order: number;
  stepName: string;
  approverRole: string;
  state: StepState;
  assignedTo?: string;
  decisionDate?: string;
  decisionComment?: string;
  decisionActor?: string;
  isFinance?: boolean;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ request, className = '' }) => {
  const steps = request.workflowTemplate?.steps;
  if (!steps || steps.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`}>
        <div className="px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Approval Workflow</h2>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">No workflow steps configured for this request type.</p>
        </div>
      </div>
    );
  }

  // Determine current active step order
  let currentOrder = request.currentStep?.order;
  if (currentOrder === undefined) {
    if (request.status === 'APPROVED') {
      currentOrder = steps.length + 1;
    } else if (request.status === 'REJECTED' || request.status === 'RETURNED') {
      const log = request.auditLogs?.slice().reverse().find((l) => l.action === request.status);
      const role = log?.actor?.role;
      const step = steps.find((s) => s.approverRole === role);
      currentOrder = step ? step.order : 1;
    } else {
      currentOrder = 0; // DRAFT or CANCELLED
    }
  }

  const totalSteps = steps.length;

  // Completed count
  let completedCount = 0;
  steps.forEach((s) => {
    if (request.status === 'APPROVED' || s.order < currentOrder) {
      completedCount++;
    }
  });

  // Collect audit logs by action for decision matching
  const approvalLogs = (request.auditLogs || []).filter((l) =>
    ['STEP_APPROVED', 'APPROVED', 'ADMIN_OVERRIDE_STEP_APPROVAL', 'REJECTED', 'ADMIN_OVERRIDE_REJECTION', 'RETURNED'].includes(l.action)
  );

  const getStepState = (stepOrder: number): StepState => {
    if (request.status === 'REJECTED' && stepOrder === currentOrder) return 'REJECTED';
    if (request.status === 'RETURNED' && stepOrder === currentOrder) return 'RETURNED';
    if (request.status === 'APPROVED' || stepOrder < currentOrder) return 'COMPLETED';
    if (stepOrder === currentOrder && request.status !== 'CANCELLED' && request.status !== 'DRAFT') return 'CURRENT';
    return 'PENDING';
  };

  const getStateLabel = (state: StepState): string => {
    switch (state) {
      case 'COMPLETED':
        return 'Approved';
      case 'CURRENT':
        return 'In review';
      case 'REJECTED':
        return 'Rejected';
      case 'RETURNED':
        return 'Returned';
      case 'PENDING':
      default:
        return 'Pending';
    }
  };

  // Map steps with status, decision history, and approver info
  const stepItems: StepInfo[] = steps.map((step) => {
    const state = getStepState(step.order);
    const isFinance =
      step.approverRole === 'FINANCE_OFFICER' ||
      step.stepName.toLowerCase().includes('finance');

    let assignedTo: string | undefined;
    if (state === 'CURRENT') {
      if (request.assignedToUser) {
        assignedTo = `${request.assignedToUser.firstName} ${request.assignedToUser.lastName} (${request.assignedToUser.roleRef?.displayName || request.assignedToUser.role.replace(/_/g, ' ')})`;
      } else {
        assignedTo = `${step.approverRole.replace(/_/g, ' ')} Pool`;
      }
    } else {
      assignedTo = `${step.approverRole.replace(/_/g, ' ')} Pool`;
    }

    // Try to find matching decision log
    let decisionDate: string | undefined;
    let decisionComment: string | undefined;
    let decisionActor: string | undefined;

    if (state === 'COMPLETED' || state === 'REJECTED' || state === 'RETURNED') {
      const matchingLog = approvalLogs.find((l) => l.actor?.role === step.approverRole);
      if (matchingLog) {
        decisionDate = fmtDateTime(matchingLog.timestamp);
        decisionComment = matchingLog.description;
        if (matchingLog.actor) {
          decisionActor = `${matchingLog.actor.firstName} ${matchingLog.actor.lastName}`;
        }
      }
    }

    return {
      id: step.id,
      order: step.order,
      stepName: step.stepName,
      approverRole: step.approverRole,
      state,
      assignedTo,
      decisionDate,
      decisionComment,
      decisionActor,
      isFinance,
    };
  });

  const activeStepNum = currentOrder > 0 && currentOrder <= totalSteps ? currentOrder : (request.status === 'APPROVED' ? totalSteps : 1);

  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`}>
      {/* Standard Card Header: px-5 py-3 border-b border-slate-200 */}
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Approval Workflow
        </h2>
        <span className="text-xs font-medium text-slate-500">
          Step {activeStepNum} of {totalSteps}
        </span>
      </div>

      {/* Standard Card Body: p-5 */}
      <div className="p-5">
        {/* Segmented Progress Bar */}
        <div
          role="progressbar"
          aria-label={`Step ${activeStepNum} of ${totalSteps}`}
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-valuenow={completedCount}
          className="flex items-center gap-1.5 mb-5"
        >
          {stepItems.map((step) => {
            let segmentColor = 'bg-slate-200';
            if (step.state === 'COMPLETED') {
              segmentColor = 'bg-emerald-600';
            } else if (step.state === 'CURRENT') {
              segmentColor = 'bg-blue-700';
            } else if (step.state === 'REJECTED') {
              segmentColor = 'bg-rose-600';
            } else if (step.state === 'RETURNED') {
              segmentColor = 'bg-amber-600';
            }
            return (
              <div
                key={`segment-${step.id || step.order}`}
                className={`h-1.5 flex-1 rounded-full ${segmentColor} transition-colors`}
              />
            );
          })}
        </div>

        {/* Vertical Steps Timeline */}
        <div className="relative pl-1">
          <ol className="relative space-y-4" role="list">
            {stepItems.map((step, idx) => {
              const isLast = idx === stepItems.length - 1;

              return (
                <li key={step.id || step.order} className="relative flex items-start gap-3">
                  {/* Connecting Line */}
                  {!isLast && (
                    <span
                      className={`absolute left-3.5 top-7 bottom-0 w-[2px] -mb-4 ${
                        step.state === 'COMPLETED' ? 'bg-emerald-300' : 'bg-slate-200'
                      }`}
                      aria-hidden="true"
                    />
                  )}

                  {/* State Node Icon */}
                  <div className="relative z-10 flex-shrink-0">
                    {step.state === 'COMPLETED' && (
                      <div className="w-7 h-7 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}

                    {step.state === 'CURRENT' && (
                      <div className="w-7 h-7 rounded-full bg-blue-50 border-2 border-blue-700 text-blue-700 flex items-center justify-center ring-4 ring-blue-100">
                        <svg className="w-3.5 h-3.5 text-blue-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                    )}

                    {step.state === 'REJECTED' && (
                      <div className="w-7 h-7 rounded-full bg-rose-50 border-2 border-rose-500 text-rose-600 flex items-center justify-center ring-4 ring-rose-100">
                        <svg className="w-3.5 h-3.5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </div>
                    )}

                    {step.state === 'RETURNED' && (
                      <div className="w-7 h-7 rounded-full bg-amber-50 border-2 border-amber-500 text-amber-600 flex items-center justify-center ring-4 ring-amber-100">
                        <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </div>
                    )}

                    {step.state === 'PENDING' && (
                      <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-300 text-slate-400 flex items-center justify-center text-xs font-medium">
                        {step.order}
                      </div>
                    )}
                  </div>

                  {/* Step Details */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold truncate ${
                        step.state === 'CURRENT'
                          ? 'text-slate-900 font-bold'
                          : step.state === 'COMPLETED'
                          ? 'text-slate-800'
                          : 'text-slate-600'
                      }`}>
                        {step.stepName}
                      </span>

                      {/* State label: sentence case text-xs font-medium */}
                      <span className={`text-xs font-medium flex-shrink-0 ${
                        step.state === 'COMPLETED'
                          ? 'text-emerald-700'
                          : step.state === 'CURRENT'
                          ? 'text-blue-700'
                          : step.state === 'REJECTED'
                          ? 'text-rose-700'
                          : step.state === 'RETURNED'
                          ? 'text-amber-800'
                          : 'text-slate-400'
                      }`}>
                        {getStateLabel(step.state)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{step.approverRole.replace(/_/g, ' ')}</span>
                      {step.isFinance && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                          Finance policy
                        </span>
                      )}
                    </div>

                    {step.assignedTo && step.state === 'CURRENT' && (
                      <p className="text-xs text-slate-600 mt-1 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                        <span className="text-slate-500">Assigned: </span>
                        <strong className="text-slate-800 font-semibold">{step.assignedTo}</strong>
                      </p>
                    )}

                    {/* Decision info if completed, rejected, or returned */}
                    {step.decisionDate && (
                      <div className="mt-1.5 text-xs text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                          <span className="font-medium text-slate-700">{step.decisionActor || 'Reviewed'}</span>
                          <span>{step.decisionDate}</span>
                        </div>
                        {step.decisionComment && (
                          <p className="text-slate-700 text-xs italic mt-0.5 break-words">
                            "{step.decisionComment}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
};

