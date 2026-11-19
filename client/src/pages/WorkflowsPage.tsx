import React, { useState, useEffect } from 'react';
import {
  api,
  type WorkflowTemplateItem,
  type WorkflowStepItem,
  type RoleItem,
  type DepartmentItem,
} from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';
import { WorkflowCanvas } from '../components/workflow-builder/WorkflowCanvas';
import { WorkflowPreviewModal } from '../components/workflow-builder/WorkflowPreviewModal';
import { isWorkflowSupported } from '../components/workflow-builder/workflowAdapter';

const REQUEST_TYPES = [
  { value: 'PURCHASE', label: 'Purchase Request' },
  { value: 'MAINTENANCE', label: 'Maintenance Request' },
  { value: 'LEAVE', label: 'Leave Request' },
  { value: 'GENERAL', label: 'General Request' },
];

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>('PURCHASE');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Feature Flag: Visual Workflow Builder
  const [useVisualBuilder, setUseVisualBuilder] = useState(true);

  // Visual Builder Modal State
  const [showVisualBuilder, setShowVisualBuilder] = useState(false);
  const [visualBuilderMode, setVisualBuilderMode] = useState<'create' | 'new_version'>('create');
  const [selectedBaseTemplate, setSelectedBaseTemplate] = useState<WorkflowTemplateItem | null>(null);

  // Read-Only Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplateItem | null>(null);

  // Fallback Classic Modal State
  const [showClassicModal, setShowClassicModal] = useState(false);
  const [classicModalMode, setClassicModalMode] = useState<'create' | 'new_version'>('create');
  const [classicBaseTemplateId, setClassicBaseTemplateId] = useState<string | null>(null);
  const [classicTemplateName, setClassicTemplateName] = useState('');
  const [classicTemplateDescription, setClassicTemplateDescription] = useState('');
  const [classicTemplateRequestType, setClassicTemplateRequestType] = useState('PURCHASE');
  const [classicSteps, setClassicSteps] = useState<WorkflowStepItem[]>([
    { stepName: 'HOD Approval', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
    { stepName: 'Procurement Review', order: 2, approverRole: 'PURCHASE_OFFICER', allowDynamicForwarding: true, isFinal: true },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classicModalError, setClassicModalError] = useState<string | null>(null);

  // Delete Workflow Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<WorkflowTemplateItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchWorkflowsData = async () => {
    try {
      setIsLoading(true);
      const [wRes, rRes, dRes] = await Promise.all([
        api.getWorkflows(),
        api.getRoles(true),
        api.getDepartments(),
      ]);
      setTemplates(wRes.data || []);
      setRoles(rRes.data || []);
      setDepartments(dRes.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflow templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflowsData();
  }, []);

  // Handle Opening Create Flow
  const handleOpenCreate = () => {
    if (useVisualBuilder) {
      setVisualBuilderMode('create');
      setSelectedBaseTemplate(null);
      setShowVisualBuilder(true);
    } else {
      setClassicModalMode('create');
      setClassicBaseTemplateId(null);
      setClassicTemplateName('');
      setClassicTemplateDescription('');
      setClassicTemplateRequestType(selectedType);
      setClassicSteps([
        { stepName: 'Initial Department Review', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
        { stepName: 'Final Verification', order: 2, approverRole: 'DIRECTOR', allowDynamicForwarding: false, isFinal: true },
      ]);
      setClassicModalError(null);
      setShowClassicModal(true);
    }
  };

  // Handle Opening New Version Flow
  const handleOpenNewVersion = (tmpl: WorkflowTemplateItem) => {
    const supportCheck = isWorkflowSupported(tmpl);
    if (!supportCheck.supported && useVisualBuilder) {
      // Fallback to classic mode if unsupported in visual builder
      setError(`Cannot open in Visual Builder: ${supportCheck.reason}. Use the classic table editor instead.`);
      return;
    }

    if (useVisualBuilder) {
      setVisualBuilderMode('new_version');
      setSelectedBaseTemplate(tmpl);
      setShowVisualBuilder(true);
    } else {
      setClassicModalMode('new_version');
      setClassicBaseTemplateId(tmpl.id);
      setClassicTemplateName(tmpl.name);
      setClassicTemplateDescription(tmpl.description || '');
      setClassicTemplateRequestType(tmpl.requestType);
      setClassicSteps(
        tmpl.steps.map((s, idx) => ({
          stepName: s.stepName,
          order: idx + 1,
          approverRole: s.approverRole,
          approverDepartmentId: s.approverDepartmentId || null,
          allowDynamicForwarding: s.allowDynamicForwarding ?? true,
          isFinal: idx === tmpl.steps.length - 1,
        }))
      );
      setClassicModalError(null);
      setShowClassicModal(true);
    }
  };

  // Visual Builder Save Handler
  const handleSaveVisualWorkflow = async (payload: {
    name: string;
    requestType: string;
    description?: string;
    steps: WorkflowStepItem[];
  }) => {
    if (visualBuilderMode === 'create') {
      await api.createWorkflow({
        name: payload.name,
        requestType: payload.requestType,
        description: payload.description,
        steps: payload.steps,
      });
      setSuccessMessage(`New workflow "${payload.name}" created and activated.`);
    } else if (visualBuilderMode === 'new_version' && selectedBaseTemplate) {
      await api.createWorkflowVersion(selectedBaseTemplate.id, {
        name: payload.name,
        description: payload.description,
        steps: payload.steps,
      });
      setSuccessMessage(
        `New version for "${payload.name}" published and activated. In-flight hospital requests remain unaffected.`
      );
    }
    setShowVisualBuilder(false);
    await fetchWorkflowsData();
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Classic Modal Step Handlers
  const handleClassicAddStep = () => {
    const newOrder = classicSteps.length + 1;
    const newStep: WorkflowStepItem = {
      stepName: `Step ${newOrder}`,
      order: newOrder,
      approverRole: roles[0]?.code || 'HOD',
      allowDynamicForwarding: true,
      isFinal: true,
    };
    const updated = classicSteps.map((s) => ({ ...s, isFinal: false }));
    setClassicSteps([...updated, newStep]);
  };

  const handleClassicRemoveStep = (index: number) => {
    if (classicSteps.length <= 1) {
      setClassicModalError('A workflow must have at least one step.');
      return;
    }
    const filtered = classicSteps.filter((_, idx) => idx !== index);
    const reordered = filtered.map((s, idx) => ({
      ...s,
      order: idx + 1,
      isFinal: idx === filtered.length - 1,
    }));
    setClassicSteps(reordered);
  };

  const handleClassicStepChange = (index: number, field: keyof WorkflowStepItem, value: any) => {
    const updated = [...classicSteps];
    updated[index] = { ...updated[index], [field]: value };
    setClassicSteps(updated);
  };

  const handleClassicSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassicModalError(null);

    if (classicSteps.length === 0) {
      setClassicModalError('Workflow must have at least one step.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (classicModalMode === 'create') {
        await api.createWorkflow({
          name: classicTemplateName.trim(),
          requestType: classicTemplateRequestType,
          description: classicTemplateDescription.trim() || undefined,
          steps: classicSteps,
        });
        setSuccessMessage(`New workflow "${classicTemplateName}" created and activated.`);
      } else if (classicModalMode === 'new_version' && classicBaseTemplateId) {
        await api.createWorkflowVersion(classicBaseTemplateId, {
          name: classicTemplateName.trim(),
          description: classicTemplateDescription.trim() || undefined,
          steps: classicSteps,
        });
        setSuccessMessage(
          `New version for "${classicTemplateName}" created and activated. Existing requests remain safely on their version.`
        );
      }
      setShowClassicModal(false);
      await fetchWorkflowsData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setClassicModalError(err.message || 'Failed to save workflow configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Safe Deletion / Archival Handlers
  const handleOpenDelete = (tmpl: WorkflowTemplateItem) => {
    setDeleteTarget(tmpl);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteWorkflow(deleteTarget.id);
      setSuccessMessage(
        `Workflow "${deleteTarget.name}" (v${deleteTarget.version}) deleted successfully.`
      );
      setDeleteTarget(null);
      await fetchWorkflowsData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete workflow template.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTemplates = templates.filter((t) => t.requestType === selectedType);
  const activeTemplate = filteredTemplates.find((t) => t.isActive);
  const historicalTemplates = filteredTemplates.filter((t) => !t.isActive);

  return (
    <DashboardLayout title="E-Office" brandPrefix="Admin" nav={<AdminNav />}>
      <div className="workflows-page max-w-6xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workflow Management</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Configure multi-step hospital approval sequences. Safe versioning ensures in-flight requests remain unaffected.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Visual Builder Feature Flag Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setUseVisualBuilder(true)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  useVisualBuilder
                    ? 'bg-white text-blue-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Visual Editor
              </button>
              <button
                type="button"
                onClick={() => setUseVisualBuilder(false)}
                className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                  !useVisualBuilder
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Classic Table
              </button>
            </div>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-md shadow-xs text-xs sm:text-sm transition-colors whitespace-nowrap"
            >
              + Create New Workflow
            </button>
          </div>
        </div>

        {/* Success & Error Banners */}
        {successMessage && (
          <div className="mb-4 p-3.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200">
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-200">
            ✕ {error}
          </div>
        )}

        {/* Request Type Selector Tabs */}
        <div className="flex gap-2 border-b border-slate-200 mb-6 pb-2">
          {REQUEST_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setSelectedType(t.value)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                selectedType === t.value
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingState message="Loading workflow templates..." />
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
            No templates configured for this request type. Click "+ Create New Workflow" to define an approval sequence.
          </div>
        ) : (
          <div className="space-y-6">
            {/* ACTIVE WORKFLOW TEMPLATE */}
            {activeTemplate && (
              (() => {
                const support = isWorkflowSupported(activeTemplate);
                return (
                  <div
                    key={activeTemplate.id}
                    className="bg-white rounded-xl shadow-xs border border-blue-200/80 ring-1 ring-blue-700/10 p-6"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900">{activeTemplate.name}</h2>
                          <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                            v{activeTemplate.version}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Active Version
                          </span>
                        </div>
                        {activeTemplate.description && (
                          <p className="text-xs text-slate-500 mt-1">{activeTemplate.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(activeTemplate)}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md transition-colors"
                        >
                          👁 Preview Pipeline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenNewVersion(activeTemplate)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-md transition-colors"
                        >
                          + Create New Version
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(activeTemplate)}
                          className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 hover:border-rose-300 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5"
                          title="Delete this workflow template"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Unsupported banner if not editable visually */}
                    {!support.supported && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                        <strong>Not editable in the visual builder:</strong> {support.reason}
                      </div>
                    )}

                    {/* Steps Overview */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                        Configured Stages ({activeTemplate.steps.length})
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeTemplate.steps.map((step) => (
                          <div
                            key={step.order}
                            className="p-3.5 bg-slate-50/75 border border-slate-200 rounded-lg flex items-start gap-3"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {step.order}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs text-slate-900 truncate">
                                {step.stepName}
                              </p>
                              <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                                Role: {step.approverRole.replace(/_/g, ' ')}
                              </p>
                              {step.approverDepartment && (
                                <p className="text-[10px] text-slate-500 truncate">
                                  Dept: {step.approverDepartment.displayName || step.approverDepartment.name}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-[10px]">
                                <span
                                  className={
                                    step.allowDynamicForwarding
                                      ? 'text-emerald-700 font-medium'
                                      : 'text-slate-400'
                                  }
                                >
                                  {step.allowDynamicForwarding
                                    ? '✓ Forwarding'
                                    : '✕ Fixed'}
                                </span>
                                {step.isFinal && (
                                  <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    Final Stage
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* HISTORICAL VERSIONS */}
            {historicalTemplates.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Historical Versions ({historicalTemplates.length})
                </h3>
                <div className="space-y-3">
                  {historicalTemplates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 opacity-90 hover:opacity-100 transition-opacity"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">{tmpl.name}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                            v{tmpl.version}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {tmpl.steps.length} stages • {tmpl._count?.requests ?? 0} request(s) processed
                          </span>
                        </div>
                        {tmpl.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{tmpl.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(tmpl)}
                          className="px-2.5 py-1 text-xs border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded"
                        >
                          👁 Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenNewVersion(tmpl)}
                          className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded"
                        >
                          Use as Base
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(tmpl)}
                          className="px-2.5 py-1 text-xs border border-rose-200 hover:bg-rose-50 text-rose-700 hover:border-rose-300 font-semibold rounded inline-flex items-center gap-1"
                          title="Delete this historical version"
                        >
                          <svg className="w-3 h-3 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VISUAL WORKFLOW BUILDER MODAL */}
        {showVisualBuilder && (
          <WorkflowCanvas
            mode={visualBuilderMode}
            initialTemplate={selectedBaseTemplate}
            defaultRequestType={selectedType}
            roles={roles}
            departments={departments}
            onSave={handleSaveVisualWorkflow}
            onClose={() => setShowVisualBuilder(false)}
          />
        )}

        {/* READ-ONLY PIPELINE PREVIEW MODAL */}
        {previewTemplate && (
          <WorkflowPreviewModal
            template={previewTemplate}
            onClose={() => setPreviewTemplate(null)}
            onUseAsBase={(tmpl) => {
              setPreviewTemplate(null);
              handleOpenNewVersion(tmpl);
            }}
          />
        )}

        {/* FALLBACK CLASSIC MODAL */}
        {showClassicModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => {
              if (!isSubmitting) setShowClassicModal(false);
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 text-left max-h-[90vh] overflow-y-auto border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="classic-modal-title"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 id="classic-modal-title" className="text-base font-bold text-slate-900">
                    {classicModalMode === 'create'
                      ? 'Create Workflow Template (Classic View)'
                      : 'Configure New Workflow Version (Classic View)'}
                  </h3>
                  <span className="text-xs font-semibold text-blue-700">
                    {classicTemplateRequestType}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClassicModal(false)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {classicModalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                  {classicModalError}
                </div>
              )}

              <form onSubmit={handleClassicSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={classicTemplateName}
                      onChange={(e) => setClassicTemplateName(e.target.value)}
                      placeholder="e.g. Standard Clinical Purchase"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Request Type
                    </label>
                    <select
                      value={classicTemplateRequestType}
                      disabled={classicModalMode === 'new_version'}
                      onChange={(e) => setClassicTemplateRequestType(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
                    >
                      {REQUEST_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={classicTemplateDescription}
                    onChange={(e) => setClassicTemplateDescription(e.target.value)}
                    placeholder="Briefly describe when this workflow applies..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-700"
                  />
                </div>

                {/* Steps Editor */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Sequential Approval Steps
                    </label>
                    <button
                      type="button"
                      onClick={handleClassicAddStep}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      + Add Step
                    </button>
                  </div>

                  <div className="space-y-3">
                    {classicSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold flex-shrink-0">
                          {idx + 1}
                        </span>

                        <div className="flex-1 w-full sm:w-auto">
                          <input
                            type="text"
                            required
                            placeholder="Step name..."
                            value={step.stepName}
                            onChange={(e) => handleClassicStepChange(idx, 'stepName', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
                          />
                        </div>

                        <div className="w-full sm:w-36">
                          <select
                            value={step.approverRole}
                            onChange={(e) => handleClassicStepChange(idx, 'approverRole', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
                          >
                            {roles.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.displayName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-full sm:w-36">
                          <select
                            value={step.approverDepartmentId || ''}
                            onChange={(e) =>
                              handleClassicStepChange(idx, 'approverDepartmentId', e.target.value || null)
                            }
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 bg-white"
                          >
                            <option value="">Any Department</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.displayName || d.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={step.allowDynamicForwarding ?? true}
                              onChange={(e) =>
                                handleClassicStepChange(idx, 'allowDynamicForwarding', e.target.checked)
                              }
                              className="rounded text-blue-700"
                            />
                            Forwarding
                          </label>

                          <button
                            type="button"
                            onClick={() => handleClassicRemoveStep(idx)}
                            className="text-red-500 hover:text-red-700 font-bold px-1.5"
                            title="Remove step"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowClassicModal(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isSubmitting ? 'Saving Workflow...' : 'Save & Activate Workflow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DELETE WORKFLOW CONFIRMATION MODAL */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => {
              if (!isDeleting) {
                setDeleteTarget(null);
                setDeleteError(null);
              }
            }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
            >
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 id="delete-modal-title" className="text-base font-bold text-slate-900">
                    Delete Workflow Template
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Are you sure you want to delete <strong className="text-slate-800">"{deleteTarget.name}" (v{deleteTarget.version})</strong>?
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200 leading-relaxed">
                  <div className="font-semibold mb-0.5">Cannot Delete Workflow</div>
                  {deleteError}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs text-slate-600 space-y-2 mb-5">
                <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                  <span>•</span>
                  <span>
                    Request Type: <span className="font-semibold text-slate-900">{deleteTarget.requestType}</span>
                  </span>
                </div>
                {deleteTarget.isActive ? (
                  <div className="flex items-start gap-2 text-amber-800 bg-amber-50/80 p-2.5 rounded border border-amber-200/80 text-[11px] leading-relaxed">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      This is the <strong>Active Version</strong>. Deleting it will automatically promote the latest remaining version for this request type. If this is the only template for this request type, deletion is blocked to prevent workflow outages.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                    <span>•</span>
                    <span>Historical version. Existing and past requests maintain their complete audit trail.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete Workflow'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
