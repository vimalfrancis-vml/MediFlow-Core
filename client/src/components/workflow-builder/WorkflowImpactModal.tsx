import React, { useState } from 'react';
import type { WorkflowTemplateItem } from '../../services/api';

interface WorkflowImpactModalProps {
  template: WorkflowTemplateItem | null;
  mode: 'create' | 'new_version';
  isSubmitting: boolean;
  onConfirm: (notes?: string) => void;
  onCancel: () => void;
}

export const WorkflowImpactModal: React.FC<WorkflowImpactModalProps> = ({
  template,
  mode,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  const [changeNotes, setChangeNotes] = useState('');

  const currentVersion = template?.version ?? 1;
  const proposedVersion = mode === 'new_version' ? currentVersion + 1 : 1;
  const linkedRequestsCount = template?._count?.requests ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-left border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="impact-modal-title"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 mb-4">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            🛡
          </div>
          <div>
            <h3 id="impact-modal-title" className="text-base font-bold text-slate-900">
              {mode === 'new_version' ? 'Confirm New Workflow Version' : 'Confirm New Workflow'}
            </h3>
            <p className="text-xs text-slate-500">
              Hospital Approval Lifecycle & In-Flight Protection
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-600">
          {mode === 'new_version' ? (
            <>
              {/* Version Numbers Comparison */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Current Active Version
                  </span>
                  <span className="text-lg font-bold text-slate-700">v{currentVersion}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">
                    Proposed New Version
                  </span>
                  <span className="text-lg font-bold text-blue-700">v{proposedVersion}</span>
                </div>
              </div>

              {/* In-Flight Protection Explanation */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700 text-sm">✓</span>
                  <div>
                    <p className="font-bold">In-Progress Requests Remain Protected</p>
                    <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                      There are currently <strong>{linkedRequestsCount}</strong> historical/active request(s) linked to version {currentVersion}. They will strictly complete their approval journey on their original version without disruption.
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                      Only newly initiated requisitions submitted after activation will utilize version {proposedVersion}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Optional Change Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Version Change Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="Summarize the modifications introduced in this version for administrative records..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
                />
              </div>
            </>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">
              <p className="font-bold">New Workflow Creation</p>
              <p className="mt-1 text-[11px] text-blue-800">
                This will create and activate version 1 for this request type. Any future modifications will automatically be tracked as new versions.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(changeNotes.trim() || undefined)}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
          >
            {isSubmitting
              ? 'Activating Version...'
              : mode === 'new_version'
              ? `Publish v${proposedVersion}`
              : 'Create & Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};
