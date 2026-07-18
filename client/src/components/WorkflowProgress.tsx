import { Fragment } from 'react';
import type { RequestItem } from '../services/api';

interface WorkflowProgressProps {
  request: RequestItem;
}

export function WorkflowProgress({ request }: WorkflowProgressProps) {
  const steps = request.workflowTemplate.steps;
  if (!steps || steps.length === 0) return null;

  let currentOrder = request.currentStep?.order;

  if (currentOrder === undefined) {
    if (request.status === 'APPROVED') {
      currentOrder = steps.length + 1;
    } else if (request.status === 'REJECTED' || request.status === 'RETURNED') {
      const log = request.auditLogs?.slice().reverse().find(l => l.action === request.status);
      const role = log?.actor?.role;
      const step = steps.find(s => s.approverRole === role);
      currentOrder = step ? step.order : 1;
    } else {
      currentOrder = 0; // DRAFT or CANCELLED
    }
  }

  const totalSteps = steps.length;
  
  // Calculate completed steps based on order and status
  let completedCount = 0;
  steps.forEach(s => {
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
    switch(state) {
      case 'COMPLETED': return 'bg-emerald-500 text-white border-emerald-500 shadow-md';
      case 'CURRENT': return 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-200 shadow-lg scale-110';
      case 'REJECTED': return 'bg-red-500 text-white border-red-500 ring-4 ring-red-100 shadow-md';
      case 'RETURNED': return 'bg-orange-500 text-white border-orange-500 ring-4 ring-orange-100 shadow-md';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  const getLineColor = (state: string) => {
    if (state === 'COMPLETED') return 'bg-emerald-500';
    return 'bg-slate-200';
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-6 overflow-hidden">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Workflow Progress</h2>
          <p className="text-sm text-slate-500 mt-1">Current Stage: {request.currentStep?.stepName || request.status}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-indigo-600">{percentage}%</div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{completedCount} of {totalSteps} Steps</p>
        </div>
      </div>

      <div className="relative">
        <div className="flex justify-between items-center relative z-10">
          {steps.map((step, index) => {
            const state = getStepState(step.order);
            const isLast = index === steps.length - 1;
            
            return (
              <Fragment key={step.id}>
                {/* Node */}
                <div className="flex flex-col items-center flex-1 relative group cursor-help">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 z-10 ${getStateStyles(state)}`}>
                    {state === 'COMPLETED' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    ) : state === 'REJECTED' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                      step.order
                    )}
                  </div>
                  <span className={`text-xs font-semibold mt-3 text-center transition-colors max-w-[100px] leading-tight ${state === 'CURRENT' ? 'text-indigo-900' : 'text-slate-500'}`}>
                    {step.stepName}
                  </span>
                  <span className={`text-[10px] mt-1 uppercase tracking-wider font-medium ${state === 'CURRENT' ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {step.approverRole.replace(/_/g, ' ')}
                  </span>
                  
                  {/* Tooltip */}
                  <div className="absolute -top-12 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-3 rounded whitespace-nowrap pointer-events-none z-20">
                    {state === 'COMPLETED' ? 'Completed' : state === 'CURRENT' ? 'Active Step' : state === 'PENDING' ? 'Awaiting action' : state}
                  </div>
                </div>

                {/* Connecting Line */}
                {!isLast && (
                  <div className="flex-auto h-[2px] -mx-4 mt-[-40px] relative z-0">
                    <div className={`absolute inset-0 transition-colors duration-500 ${getLineColor(state)}`} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
