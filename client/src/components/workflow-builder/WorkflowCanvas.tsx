import React, { useState, useEffect, useCallback } from 'react';
import type { WorkflowStepItem, WorkflowTemplateItem, RoleItem, DepartmentItem } from '../../services/api';
import {
  stepsToVisualNodes,
  visualNodesToSteps,
  reorderVisualStages,
  validateWorkflowSteps,
  type VisualNode,
} from './workflowAdapter';
import { WorkflowStageCard } from './WorkflowStageCard';
import { WorkflowInspector } from './WorkflowInspector';
import { WorkflowImpactModal } from './WorkflowImpactModal';

interface WorkflowCanvasProps {
  mode: 'create' | 'new_version';
  initialTemplate?: WorkflowTemplateItem | null;
  defaultRequestType: string;
  roles: RoleItem[];
  departments: DepartmentItem[];
  onSave: (payload: {
    name: string;
    requestType: string;
    description?: string;
    steps: WorkflowStepItem[];
  }) => Promise<void>;
  onClose: () => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  mode,
  initialTemplate,
  defaultRequestType,
  roles,
  departments,
  onSave,
  onClose,
}) => {
  // Workflow Header Metadata
  const [templateName, setTemplateName] = useState(
    initialTemplate?.name || (mode === 'create' ? `Standard ${defaultRequestType} Approval Flow` : '')
  );
  const [templateDescription, setTemplateDescription] = useState(
    initialTemplate?.description || ''
  );
  const [requestType] = useState<string>(
    initialTemplate?.requestType || defaultRequestType
  );

  // Visual Nodes
  const [nodes, setNodes] = useState<VisualNode[]>(() => {
    if (initialTemplate && initialTemplate.steps && initialTemplate.steps.length > 0) {
      return stepsToVisualNodes(initialTemplate.steps, initialTemplate.requestType);
    }
    const defaultInitialSteps: WorkflowStepItem[] = [
      { stepName: 'HOD Approval', order: 1, approverRole: roles[0]?.code || 'HOD', allowDynamicForwarding: true },
      { stepName: 'Administrative Review', order: 2, approverRole: roles[1]?.code || 'DIRECTOR', allowDynamicForwarding: true, isFinal: true },
    ];
    return stepsToVisualNodes(defaultInitialSteps, defaultRequestType);
  });

  // Active Selected Node for Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Unsaved Changes & Confirmation
  const [isDirty, setIsDirty] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Canvas View Controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Guard against accidental tab close or page navigation when changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Handle stage selection
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Add new stage
  const handleAddStage = () => {
    const approvalNodes = nodes.filter((n) => n.kind === 'APPROVAL');
    const newOrder = approvalNodes.length + 1;
    const defaultRole = roles.find((r) => r.code === 'HOD')?.code || roles[0]?.code || 'HOD';

    const newApprovalNode: VisualNode = {
      id: `node-step-${newOrder}-${Date.now()}`,
      kind: 'APPROVAL',
      stepName: `Approval Stage ${newOrder}`,
      order: newOrder,
      approverRole: defaultRole,
      approverDepartmentId: null,
      approverDepartmentName: null,
      allowDynamicForwarding: true,
      isFinal: true,
    };

    // Update previous last approval node so it's not final
    const updatedApprovalNodes = approvalNodes.map((n) => ({
      ...n,
      isFinal: false,
    }));

    const startNode = nodes[0]!;
    const endNode = nodes[nodes.length - 1]!;
    const nextNodes = [startNode, ...updatedApprovalNodes, newApprovalNode, endNode];

    setNodes(nextNodes);
    setSelectedNodeId(newApprovalNode.id);
    setIsDirty(true);
    setErrorMessage(null);
  };

  // Move stage up
  const handleMoveUp = useCallback(
    (approvalIndex: number) => {
      if (approvalIndex <= 0) return;
      const reordered = reorderVisualStages(nodes, approvalIndex, approvalIndex - 1);
      setNodes(reordered);
      setIsDirty(true);
    },
    [nodes]
  );

  // Move stage down
  const handleMoveDown = useCallback(
    (approvalIndex: number) => {
      const approvalNodes = nodes.filter((n) => n.kind === 'APPROVAL');
      if (approvalIndex >= approvalNodes.length - 1) return;
      const reordered = reorderVisualStages(nodes, approvalIndex, approvalIndex + 1);
      setNodes(reordered);
      setIsDirty(true);
    },
    [nodes]
  );

  // Delete stage
  const handleDeleteStage = useCallback(
    (approvalIndex: number) => {
      const approvalNodes = nodes.filter((n) => n.kind === 'APPROVAL');
      if (approvalNodes.length <= 1) {
        setErrorMessage('A workflow template must contain at least one approval stage.');
        return;
      }

      const filtered = approvalNodes.filter((_, idx) => idx !== approvalIndex);
      const reindexed = filtered.map((n, idx) => ({
        ...n,
        order: idx + 1,
        isFinal: idx === filtered.length - 1,
      }));

      const startNode = nodes[0]!;
      const endNode = nodes[nodes.length - 1]!;
      const nextNodes = [startNode, ...reindexed, endNode];

      setNodes(nextNodes);
      setSelectedNodeId(null);
      setIsDirty(true);
      setErrorMessage(null);
    },
    [nodes]
  );

  // Update selected stage
  const handleUpdateStage = (updated: Partial<VisualNode>) => {
    if (!selectedNodeId) return;

    setNodes((prev) =>
      prev.map((node) => {
        if (node.id === selectedNodeId) {
          return { ...node, ...updated };
        }
        return node;
      })
    );
    setIsDirty(true);
    setErrorMessage(null);
  };

  // Discard changes
  const handleDiscardChanges = () => {
    if (isDirty && !window.confirm('Are you sure you want to discard your unsaved modifications?')) {
      return;
    }
    onClose();
  };

  // Validate and initiate save flow
  const handleInitiateSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!templateName.trim()) {
      setErrorMessage('Workflow template name is required.');
      return;
    }

    const compiledSteps = visualNodesToSteps(nodes);
    const validationError = validateWorkflowSteps(compiledSteps);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    // Open version impact confirmation modal
    setShowImpactModal(true);
  };

  // Confirm save
  const handleConfirmSave = async (notes?: string) => {
    setIsSubmitting(true);
    try {
      const compiledSteps = visualNodesToSteps(nodes);
      await onSave({
        name: templateName.trim(),
        requestType,
        description: notes || templateDescription.trim() || undefined,
        steps: compiledSteps,
      });
      setIsDirty(false);
      setShowImpactModal(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save workflow template.');
      setShowImpactModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const approvalStages = nodes.filter((n) => n.kind === 'APPROVAL');

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs flex flex-col justify-between">
      <div className="bg-white flex-1 flex flex-col overflow-hidden max-w-7xl w-full mx-auto my-3 md:my-5 rounded-xl shadow-2xl border border-slate-200">
        {/* TOP BAR */}
        <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50/75 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
              E
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => {
                    setTemplateName(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Workflow Name (e.g. Standard Purchase)"
                  className="font-bold text-base text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-700 focus:bg-white px-1 py-0.5 rounded focus:outline-none transition-colors truncate max-w-md"
                />
                <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-50 text-blue-800 border border-blue-200 flex-shrink-0">
                  {requestType}
                </span>
                {mode === 'new_version' && initialTemplate && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                    Target: v{initialTemplate.version + 1}
                  </span>
                )}
                {isDirty && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-50 text-amber-800 border border-amber-200 flex-shrink-0">
                    ● Modified
                  </span>
                )}
              </div>
              <input
                type="text"
                value={templateDescription}
                onChange={(e) => {
                  setTemplateDescription(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Workflow description (optional)..."
                className="text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-700 focus:bg-white px-1 py-0.5 rounded focus:outline-none transition-colors w-full max-w-lg mt-0.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md transition-colors"
            >
              Discard Changes
            </button>
            <button
              type="button"
              onClick={handleInitiateSave}
              className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
            >
              {mode === 'new_version' ? 'Save New Version' : 'Save & Activate'}
            </button>
          </div>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>✕</span>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* 3-COLUMN EDITOR WORKSPACE */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-slate-100/50">
          {/* LEFT PANEL: COMPONENT PALETTE & RULE NOTICES (3 COLS) */}
          <div className="hidden md:flex md:col-span-3 border-r border-slate-200 bg-white p-5 flex-col justify-between overflow-y-auto">
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Workflow Palette
                </h4>
                <p className="text-xs text-slate-500">
                  Workflows follow a guaranteed linear sequence from Start to Terminal Execution.
                </p>
              </div>

              {/* Palette Actions */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors shadow-2xs"
                >
                  <span className="text-base">+</span> Add Approval Stage
                </button>
              </div>

              {/* Engine Dynamic Invariant Info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-[11px] text-slate-600">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>ℹ</span> Hospital Invariant Rules
                </p>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-500">
                  <li>
                    <strong>Finance Invariant:</strong> Requests exceeding ₹1,00,000 dynamically prepend Finance Review at Step 1.
                  </li>
                  <li>
                    <strong>Director Review:</strong> High-cost purchases dynamically require Hospital Director sign-off.
                  </li>
                  <li>
                    <strong>HOD Prevention:</strong> Requester HOD self-approvals are automatically bypassed.
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
              E-Office Core Approval Engine v1.0 • Phase 1
            </div>
          </div>

          {/* CENTRE PANEL: VISUAL PIPELINE CANVAS (6 COLS) */}
          <div className="col-span-1 md:col-span-6 overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
            {/* Canvas Viewport Toolbar */}
            <div className="w-full max-w-xl flex justify-between items-center mb-4 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">
                Pipeline Sequence ({approvalStages.length} Approval Stages)
              </span>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(75, z - 10))}
                  className="px-2 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold"
                  title="Zoom Out"
                >
                  -
                </button>
                <span className="px-1 text-[11px] font-medium">{zoomLevel}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(125, z + 10))}
                  className="px-2 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(100)}
                  className="px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-100 rounded border-l border-slate-100"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Visual Canvas Elements */}
            <div
              className="w-full transition-all duration-150"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            >
              <div className="space-y-3 pb-8">
                {nodes.map((node, idx) => {
                  const isApproval = node.kind === 'APPROVAL';
                  const approvalIdx = isApproval
                    ? approvalStages.findIndex((a) => a.id === node.id)
                    : -1;

                  return (
                    <React.Fragment key={node.id}>
                      <WorkflowStageCard
                        node={node}
                        isSelected={selectedNodeId === node.id}
                        approvalIndex={approvalIdx}
                        totalApprovalStages={approvalStages.length}
                        onSelect={(n) => setSelectedNodeId(n.id)}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onDelete={handleDeleteStage}
                      />

                      {/* DOWNWARD ARROW CONNECTOR */}
                      {idx < nodes.length - 1 && (
                        <div className="flex justify-center my-0.5" aria-hidden="true">
                          <div className="w-0.5 h-6 bg-slate-300 relative">
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-solid border-t-slate-400 border-t-4 border-x-transparent border-x-4 border-b-0" />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: CONFIGURATION INSPECTOR (3 COLS) */}
          <div className="col-span-1 md:col-span-3 border-t md:border-t-0 md:border-l border-slate-200 bg-white p-5 overflow-y-auto">
            <WorkflowInspector
              selectedNode={selectedNode}
              roles={roles}
              departments={departments}
              onUpdateStage={handleUpdateStage}
            />
          </div>
        </div>
      </div>

      {/* VERSION IMPACT CONFIRMATION MODAL */}
      {showImpactModal && (
        <WorkflowImpactModal
          template={initialTemplate || null}
          mode={mode}
          isSubmitting={isSubmitting}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowImpactModal(false)}
        />
      )}
    </div>
  );
};
