import React, { useState, useEffect } from 'react';
import { api, type WorkflowTemplateItem, type WorkflowStepItem, type RoleItem, type DepartmentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';

const REQUEST_TYPES = [
  { value: 'PURCHASE', label: 'Purchase Request' },
  { value: 'MAINTENANCE', label: 'Maintenance Request' },
  { value: 'LEAVE', label: 'Leave Request' },
];

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [selectedType, setSelectedType] = useState<string>('PURCHASE');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Builder Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'new_version'>('create');
  const [baseTemplateId, setBaseTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateRequestType, setTemplateRequestType] = useState('PURCHASE');
  const [steps, setSteps] = useState<WorkflowStepItem[]>([
    { stepName: 'HOD Approval', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
    { stepName: 'Procurement Review', order: 2, approverRole: 'PURCHASE_OFFICER', allowDynamicForwarding: true, isFinal: true },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal, isSubmitting]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setBaseTemplateId(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateRequestType(selectedType);
    setSteps([
      { stepName: 'Initial Department Review', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
      { stepName: 'Final Verification', order: 2, approverRole: 'DIRECTOR', allowDynamicForwarding: false, isFinal: true },
    ]);
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenNewVersion = (tmpl: WorkflowTemplateItem) => {
    setModalMode('new_version');
    setBaseTemplateId(tmpl.id);
    setTemplateName(tmpl.name);
    setTemplateDescription(tmpl.description || '');
    setTemplateRequestType(tmpl.requestType);
    setSteps(
      tmpl.steps.map((s, idx) => ({
        stepName: s.stepName,
        order: idx + 1,
        approverRole: s.approverRole,
        approverDepartmentId: s.approverDepartmentId || null,
        allowDynamicForwarding: s.allowDynamicForwarding ?? true,
        isFinal: idx === tmpl.steps.length - 1,
      }))
    );
    setModalError(null);
    setShowModal(true);
  };

  const handleAddStep = () => {
    const newOrder = steps.length + 1;
    const newStep: WorkflowStepItem = {
      stepName: `Step ${newOrder}`,
      order: newOrder,
      approverRole: roles[0]?.code || 'HOD',
      allowDynamicForwarding: true,
      isFinal: true,
    };
    // mark previous last step as non-final
    const updated = steps.map((s) => ({ ...s, isFinal: false }));
    setSteps([...updated, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      setModalError('A workflow must have at least one step.');
      return;
    }
    const filtered = steps.filter((_, idx) => idx !== index);
    // Reorder 1..N
    const reordered = filtered.map((s, idx) => ({
      ...s,
      order: idx + 1,
      isFinal: idx === filtered.length - 1,
    }));
    setSteps(reordered);
  };

  const handleStepChange = (index: number, field: keyof WorkflowStepItem, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleSaveWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    // Front-end sanity check
    if (steps.length === 0) {
      setModalError('Workflow must have at least one step.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === 'create') {
        await api.createWorkflow({
          name: templateName.trim(),
          requestType: templateRequestType,
          description: templateDescription.trim() || undefined,
          steps,
        });
        setSuccessMessage(`New workflow "${templateName}" created and activated.`);
      } else if (modalMode === 'new_version' && baseTemplateId) {
        await api.createWorkflowVersion(baseTemplateId, {
          name: templateName.trim(),
          description: templateDescription.trim() || undefined,
          steps,
        });
        setSuccessMessage(`New version for "${templateName}" created and activated. Existing requests remain safely on their version.`);
      }
      setShowModal(false);
      await fetchWorkflowsData();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save workflow configuration.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive workflow "${name}"? Historical requests will maintain their audit records.`)) {
      return;
    }
    try {
      await api.archiveWorkflow(id);
      setSuccessMessage(`Workflow "${name}" archived.`);
      await fetchWorkflowsData();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to archive workflow');
    }
  };

  const filteredTemplates = templates.filter((t) => t.requestType === selectedType);

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <div className="workflows-page max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Workflow Management</h1>
            <p className="text-slate-500 mt-1">
              Configure multi-step approval sequences. Safe versioning ensures in-flight requests remain unaffected.
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-xs text-sm transition-colors whitespace-nowrap"
          >
            + Create New Workflow
          </button>
        </div>

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded-md border border-emerald-200">
            ✓ {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-md border border-red-200">
            ✕ {error}
          </div>
        )}

        {/* Type Selector Tabs */}
        <div className="flex gap-2 border-b border-slate-200 mb-6 pb-2">
          {REQUEST_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setSelectedType(t.value)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                selectedType === t.value
                  ? 'bg-indigo-600 text-white shadow-xs'
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
            No templates found for this request type. Click "+ Create New Workflow" to define an approval sequence.
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className={`bg-white rounded-xl shadow-xs border transition-all ${
                  tmpl.isActive ? 'border-indigo-200/80 ring-1 ring-indigo-500/10' : 'border-slate-200 opacity-80'
                } p-6`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{tmpl.name}</h2>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                        v{tmpl.version}
                      </span>
                      <span
                        className={`status-badge text-[10px] ${
                          tmpl.isActive ? 'status-active' : 'status-inactive'
                        }`}
                      >
                        {tmpl.isActive ? 'Active Version' : 'Inactive'}
                      </span>
                    </div>
                    {tmpl.description && (
                      <p className="text-xs text-slate-500 mt-1">{tmpl.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenNewVersion(tmpl)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-md transition-colors"
                    >
                      + Create New Version
                    </button>
                    {tmpl.isActive && (
                      <button
                        onClick={() => handleArchive(tmpl.id, tmpl.name)}
                        className="px-3 py-1.5 border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-600 text-xs font-semibold rounded-md transition-colors"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>

                {/* Steps Visualizer */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Configured Steps ({tmpl.steps.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tmpl.steps.map((step) => (
                      <div
                        key={step.order}
                        className="p-3 bg-slate-50/75 border border-slate-200 rounded-lg flex items-start gap-2.5"
                      >
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {step.order}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-slate-900 truncate">{step.stepName}</p>
                          <p className="text-[11px] text-indigo-700 font-semibold mt-0.5">
                            Role: {step.approverRole.replace(/_/g, ' ')}
                          </p>
                          {step.approverDepartment && (
                            <p className="text-[10px] text-slate-500 truncate">
                              Dept: {step.approverDepartment.displayName || step.approverDepartment.name}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                            <span className={step.allowDynamicForwarding ? 'text-emerald-600' : 'text-slate-400'}>
                              {step.allowDynamicForwarding ? '✓ Forwarding Allowed' : '✕ Fixed Assignee'}
                            </span>
                            {step.isFinal && (
                              <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Final Step
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WORKFLOW BUILDER MODAL */}
        {showModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
            onClick={() => { if (!isSubmitting) setShowModal(false); }}
          >
            <div 
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 text-left max-h-[90vh] overflow-y-auto border border-slate-200"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wf-modal-title"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
                <div>
                  <h3 id="wf-modal-title" className="text-lg font-bold text-slate-900">
                    {modalMode === 'create' ? 'Create Workflow Template' : 'Configure New Workflow Version'}
                  </h3>
                  <span className="text-xs font-semibold text-indigo-600">{templateRequestType}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {modalError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleSaveWorkflow} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g. Standard Clinical Purchase"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Request Type</label>
                    <select
                      value={templateRequestType}
                      disabled={modalMode === 'new_version'}
                      onChange={(e) => setTemplateRequestType(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                    >
                      {REQUEST_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Briefly describe when this workflow applies..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
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
                      onClick={handleAddStep}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      + Add Step
                    </button>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs"
                      >
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">
                          {idx + 1}
                        </span>

                        <div className="flex-1 w-full sm:w-auto">
                          <input
                            type="text"
                            required
                            placeholder="Step name..."
                            value={step.stepName}
                            onChange={(e) => handleStepChange(idx, 'stepName', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                          />
                        </div>

                        <div className="w-full sm:w-36">
                          <select
                            value={step.approverRole}
                            onChange={(e) => handleStepChange(idx, 'approverRole', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                          >
                            {roles.map((r) => (
                              <option key={r.code} value={r.code}>{r.displayName}</option>
                            ))}
                          </select>
                        </div>

                        <div className="w-full sm:w-36">
                          <select
                            value={step.approverDepartmentId || ''}
                            onChange={(e) => handleStepChange(idx, 'approverDepartmentId', e.target.value || null)}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                          >
                            <option value="">Any Department</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>{d.displayName || d.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-slate-600 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={step.allowDynamicForwarding ?? true}
                              onChange={(e) => handleStepChange(idx, 'allowDynamicForwarding', e.target.checked)}
                              className="rounded text-indigo-600"
                            />
                            Forwarding
                          </label>

                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
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
                    onClick={() => setShowModal(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs"
                  >
                    {isSubmitting ? 'Saving Workflow...' : 'Save & Activate Workflow'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
