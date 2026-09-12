import { Fragment } from 'react';
import type { RequestItem } from '../services/api';
import { useTerminology } from '../context/TerminologyContext';

interface WorkflowProgressProps {
  request: RequestItem;
}

export function WorkflowProgress({ request }: WorkflowProgressProps) {
  const { getStatusLabel } = useTerminology();
  const steps = request.workflowTemplate?.steps;
  if (!steps || steps.length === 0) return null;

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

  // Calculate completed steps based on order and status
  let completedCount = 0;
  steps.forEach((s) => {
    if (request.status === 'APPROVED' || s.order < currentOrder) {
      completedCount++;
    }
  });

  const percentage = Math.round((completedCount / totalSteps) * 100);

  const getStepState = (stepOrder: number) => {
    if (request.status === 'REJECTED' && stepOrder === currentOrder) return 'REJECTED';
    if (request.status === 'RETURNED' && stepOrder === currentOrder) return 'RETURNED';
    if (request.status === 'APPROVED' || stepOrder < currentOrder) return 'COMPLETED';
    if (stepOrder === currentOrder && request.status !== 'CANCELLED' && request.status !== 'DRAFT') return 'CURRENT';
    return 'PENDING';
  };

  const getStateStyles = (state: string) => {
    switch (state) {
      case 'COMPLETED':
        return 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
      case 'CURRENT':
        return 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100 shadow-md scale-105';
      case 'REJECTED':
        return 'bg-rose-600 text-white border-rose-600 ring-4 ring-rose-100 shadow-sm';
      case 'RETURNED':
        return 'bg-orange-500 text-white border-orange-500 ring-4 ring-orange-100 shadow-sm';
      default:
        return 'bg-slate-50 text-slate-400 border-slate-300';
    }
  };

  const getLineColor = (state: string) => {
    if (state === 'COMPLETED') return 'bg-emerald-500';
    return 'bg-slate-200';
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-xs border border-slate-200/80 mb-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">Workflow Progress</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Stage {currentOrder > 0 && currentOrder <= totalSteps ? `${currentOrder} of ${totalSteps}` : '—'}:{' '}
            <span className="font-semibold text-slate-800">
              {request.currentStep?.stepName || getStatusLabel(request.status)}
            </span>
          </p>
        </div>
        <div className="flex items-center sm:flex-col sm:items-end gap-2 sm:gap-0">
          <div className="text-xl sm:text-2xl font-bold text-indigo-600">{percentage}%</div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {completedCount} of {totalSteps} Steps Complete
          </p>
        </div>
      </div>

      <div className="relative pl-1 md:pl-0">
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center relative z-10 gap-6 md:gap-0">
          {steps.map((step, index) => {
            const state = getStepState(step.order);
            const isLast = index === steps.length - 1;
            const isFinance =
              step.approverRole === 'FINANCE_OFFICER' ||
              step.stepName.toLowerCase().includes('finance');

            return (
              <Fragment key={step.id}>
                {/* Step node */}
                <div
                  className="flex flex-row md:flex-col items-start md:items-center gap-3 md:gap-0 flex-1 relative group w-full md:w-auto"
                  tabIndex={0}
                  role="group"
                  aria-label={`Step ${step.order}: ${step.stepName} (${state})`}
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border-2 transition-all duration-200 z-10 flex-shrink-0 ${getStateStyles(
                      state
                    )}`}
                  >
                    {state === 'COMPLETED' ? (
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : state === 'REJECTED' ? (
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : state === 'RETURNED' ? (
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    ) : (
                      step.order
                    )}
                  </div>

                  <div className="flex flex-col items-start md:items-center mt-0.5 md:mt-2.5 leading-tight">
                    <span
                      className={`text-xs font-semibold text-left md:text-center max-w-[220px] md:max-w-[120px] ${
                        state === 'CURRENT'
                          ? 'text-indigo-950 font-bold'
                          : state === 'COMPLETED'
                          ? 'text-slate-800'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.stepName}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 text-left md:text-center">
                        {step.approverRole.replace(/_/g, ' ')}
                      </span>
                      {isFinance && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                          ₹ Policy
                        </span>
                      )}
                    </div>

                    {/* State pill */}
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-1 ${
                        state === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : state === 'CURRENT'
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : state === 'REJECTED'
                          ? 'bg-rose-50 text-rose-700'
                          : state === 'RETURNED'
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {state === 'CURRENT' ? 'In Review' : state.toLowerCase()}
                    </span>
                  </div>

                  {/* Connecting line */}
                  {!isLast && (
                    <div className="absolute left-[17px] sm:left-[19px] top-9 w-[2px] h-7 md:relative md:left-auto md:top-auto md:w-auto md:h-[2px] md:flex-auto md:-mx-4 md:mt-[-48px] z-0">
                      <div className={`absolute inset-0 transition-colors duration-300 ${getLineColor(state)}`} />
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
