import React from 'react';
import type { VisualNode } from './workflowAdapter';
import type { RoleItem, DepartmentItem } from '../../services/api';

interface WorkflowInspectorProps {
  selectedNode: VisualNode | null;
  roles: RoleItem[];
  departments: DepartmentItem[];
  readOnly?: boolean;
  onUpdateStage: (updated: Partial<VisualNode>) => void;
}

export const WorkflowInspector: React.FC<WorkflowInspectorProps> = ({
  selectedNode,
  roles,
  departments,
  readOnly = false,
  onUpdateStage,
}) => {
  if (!selectedNode) {
    return (
      <div className="p-6 bg-slate-50/75 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold">
          ⚙
        </div>
        <p className="font-semibold text-slate-700">No Stage Selected</p>
        <p className="mt-1 text-slate-500">
          Click any approval stage in the canvas to inspect or adjust its role and department scope.
        </p>
      </div>
    );
  }

  if (selectedNode.kind === 'START') {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs text-left">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
            1
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Request Submission Stage</h3>
            <p className="text-[11px] text-slate-500">System Workflow Entry Point</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-700">Display-Only Component</p>
            <p className="mt-1 text-[11px] text-slate-500">
              The submission step is initiated by authorized hospital staff via their respective portal. It is automatically linked to the first approval stage of the workflow.
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            • Requester enters department, justification, and details.<br />
            • Dynamic rules are evaluated upon formal submission.
          </div>
        </div>
      </div>
    );
  }

  if (selectedNode.kind === 'END') {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs text-left">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <span className="w-6 h-6 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Terminal Approval Stage</h3>
            <p className="text-[11px] text-slate-500">Workflow Execution Completion</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="font-semibold text-slate-700">Terminal State</p>
            <p className="mt-1 text-[11px] text-slate-500">
              When the final approval stage is signed off, the requisition transitions to Approved. PO generation, leave allotment, or work order dispatch is triggered.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // APPROVAL STAGE INSPECTOR
  const isLocked = readOnly || selectedNode.isAutomatic;

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Stage {selectedNode.order} Configuration
          </h3>
          <p className="text-[11px] text-slate-500">Inspect and configure approval requirements</p>
        </div>
        {selectedNode.isFinal && (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200">
            Final Stage
          </span>
        )}
      </div>

      {isLocked && (
        <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          🔒 <strong>Read-Only:</strong> This stage cannot be modified in the current view.
        </div>
      )}

      <div className="space-y-4">
        {/* Stage Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Stage Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            disabled={isLocked}
            value={selectedNode.stepName}
            onChange={(e) => onUpdateStage({ stepName: e.target.value })}
            placeholder="e.g. Department HOD Review"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Approver Role */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Approver Role <span className="text-red-500">*</span>
          </label>
          <select
            disabled={isLocked}
            value={selectedNode.approverRole}
            onChange={(e) => onUpdateStage({ approverRole: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white disabled:bg-slate-50 disabled:text-slate-500"
          >
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.displayName || r.code.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Determines which user role receives approval authority for this step.
          </p>
        </div>

        {/* Department Scope */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Department Scope
          </label>
          <select
            disabled={isLocked}
            value={selectedNode.approverDepartmentId || ''}
            onChange={(e) => {
              const deptId = e.target.value || null;
              const dept = departments.find((d) => d.id === deptId);
              onUpdateStage({
                approverDepartmentId: deptId,
                approverDepartmentName: dept ? dept.displayName || dept.name : null,
              });
            }}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="">Any Department (Requester's Department)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName || d.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Scope limit for approver selection (defaults to matching the requester's department).
          </p>
        </div>

        {/* Dynamic Forwarding */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              disabled={isLocked}
              checked={selectedNode.allowDynamicForwarding ?? true}
              onChange={(e) => onUpdateStage({ allowDynamicForwarding: e.target.checked })}
              className="mt-0.5 rounded text-blue-700 focus:ring-blue-700"
            />
            <div>
              <span className="font-semibold text-slate-800">Allow Dynamic Forwarding</span>
              <p className="text-[11px] text-slate-500">
                Permits the assigned approver to forward this requisition to another qualified hospital officer with notes.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
