import React, { useState, useEffect } from 'react';
import { api, type RequestSummaryResult } from '../../services/api';

interface RequestAISummaryModalProps {
  requestId: string;
  onClose: () => void;
}

export const RequestAISummaryModal: React.FC<RequestAISummaryModalProps> = ({
  requestId,
  onClose,
}) => {
  const [data, setData] = useState<RequestSummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    api
      .getRequestIntelligenceSummary(requestId)
      .then((res) => {
        if (isMounted && res.data) {
          setData(res.data);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Failed to generate intelligence summary');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 text-left max-h-[90vh] overflow-y-auto border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-modal-title"
      >
        <div className="flex justify-between items-start pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              <svg className="w-4 h-4 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 id="summary-modal-title" className="text-base font-bold text-slate-900">
                Approval Intelligence Summary
              </h3>
              <p className="text-xs text-slate-500">
                Factual System Data & Synthesized Intelligence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            aria-label="Close summary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-xs text-slate-500">
            <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="font-semibold">Synthesizing Request Intelligence...</p>
          </div>
        ) : error || !data ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-semibold">
            {error || 'Unable to retrieve summary'}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. VERIFIED SYSTEM DATA */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Verified System Data
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                    Reference Number
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {data.referenceNumber}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                    Department
                  </span>
                  <span className="font-semibold text-slate-800">{data.departmentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                    Current Stage
                  </span>
                  <span className="font-bold text-blue-700">{data.currentStage}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                    Time at Stage
                  </span>
                  <span className="font-bold text-slate-800">
                    {data.factualOverview.waitDuration}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                    Assigned Reviewer
                  </span>
                  <span className="font-medium text-slate-700">
                    {data.factualOverview.assignedApprover}
                  </span>
                </div>
                {data.factualOverview.financialAmount !== undefined && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                      Expenditure Amount
                    </span>
                    <span className="font-bold text-slate-900">
                      ₹{data.factualOverview.financialAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. AI-GENERATED INTERPRETATION */}
            <div className="p-4 bg-blue-50/40 border border-blue-200 rounded-xl text-left">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-100">
                <svg className="w-4 h-4 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  AI-Generated Interpretation
                </h4>
              </div>

              <p className="text-xs text-slate-800 leading-relaxed font-medium mb-3">
                {data.aiInterpretation.summaryText}
              </p>

              {/* Missing Information Checklist */}
              {data.aiInterpretation.missingInformation &&
                data.aiInterpretation.missingInformation.length > 0 && (
                  <div className="mb-3 p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs">
                    <span className="font-bold text-amber-900 block mb-1">
                      Potentially Missing Information:
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-amber-800 text-[11px]">
                      {data.aiInterpretation.missingInformation.map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Attention Suggestion */}
              {data.aiInterpretation.suggestedAttentionNote && (
                <div className="p-3 bg-white border border-blue-200 rounded-lg text-xs text-slate-700 mb-3">
                  <span className="font-bold text-blue-900">Recommended Attention: </span>
                  <span>{data.aiInterpretation.suggestedAttentionNote}</span>
                </div>
              )}

              {/* Mandatory AI Disclaimer */}
              <p className="text-[11px] text-slate-500 italic border-t border-blue-100 pt-2">
                {data.aiInterpretation.disclaimer}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-slate-100 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Close Summary
          </button>
        </div>
      </div>
    </div>
  );
};
