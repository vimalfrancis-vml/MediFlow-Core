import React from 'react';
import type { WorkflowTemplateItem } from '../../services/api';
import { isWorkflowSupported, stepsToVisualNodes } from './workflowAdapter';
import { WorkflowStageCard } from './WorkflowStageCard';

interface WorkflowPreviewModalProps {
  template: WorkflowTemplateItem;
  onClose: () => void;
  onUseAsBase?: (template: WorkflowTemplateItem) => void;
}

export const WorkflowPreviewModal: React.FC<WorkflowPreviewModalProps> = ({
  template,
  onClose,
  onUseAsBase,
}) => {
  const supportCheck = isWorkflowSupported(template);
  const visualNodes = stepsToVisualNodes(template.steps, template.requestType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 text-left max-h-[90vh] flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100 mb-4 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 id="preview-modal-title" className="text-lg font-bold text-slate-900">
                {template.name}
              </h3>
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                v{template.version}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  template.isActive
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {template.isActive ? 'Active Version' : 'Historical Version'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Request Type: <strong className="text-blue-700">{template.requestType}</strong>
              {template.createdAt && (
                <span> • Created on {new Date(template.createdAt).toLocaleDateString()}</span>
              )}
            </p>
            {template.description && (
              <p className="text-xs text-slate-600 mt-1">{template.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Unsupported Warning Banner if applicable */}
        {!supportCheck.supported && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex-shrink-0">
            <p className="font-bold text-xs uppercase tracking-wider text-amber-800">
              Not editable in the visual builder
            </p>
            <p className="text-xs mt-1">{supportCheck.reason}</p>
          </div>
        )}

        {/* Pipeline Preview Sequence */}
        <div className="flex-1 overflow-y-auto pr-2 py-2 space-y-4">
          {visualNodes.map((node, idx) => (
            <React.Fragment key={node.id}>
              <WorkflowStageCard
                node={node}
                isSelected={false}
                readOnly={true}
                onSelect={() => {}}
              />
              {idx < visualNodes.length - 1 && (
                <div className="flex justify-center my-1" aria-hidden="true">
                  <div className="w-0.5 h-6 bg-slate-300 relative">
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-slate-400 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4 flex-shrink-0">
          <div className="text-[11px] text-slate-500">
            Total Requests Processed: <strong>{template._count?.requests ?? 0}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {supportCheck.supported && onUseAsBase && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onUseAsBase(template);
                }}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
              >
                Create New Version From This
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
