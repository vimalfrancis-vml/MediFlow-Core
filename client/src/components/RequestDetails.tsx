import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, type RequestItem, type CommentItem } from '../services/api';
import { DashboardLayout } from './DashboardLayout';
import { LoadingState } from './LoadingState';
import { StatusChip } from './StatusChip';
import { ApprovalTimeline } from './ApprovalTimeline';
import { AttachmentList } from './AttachmentList';
import { ActivityLog } from './ActivityLog';
import { ActionBar } from './ActionBar';
import { DecisionModal, type DecisionActionType } from './DecisionModal';
import { CancelRequestModal } from './CancelRequestModal';
import { RequestTypeDetails } from './RequestTypeDetails';
import { useAuth } from '../context/AuthContext';
import { useTerminology } from '../context/TerminologyContext';
import { fmtDateTime } from '../utils/date';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import '../pages/RequestDetailsPage.css';

export interface RequestDetailsProps {
  mode: 'employee' | 'approver';
  id?: string;
}

export const RequestDetails: React.FC<RequestDetailsProps> = ({ mode, id: propId }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();

  const [request, setRequest] = useState<RequestItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Approver decision modal state
  const [activeDecisionAction, setActiveDecisionAction] = useState<DecisionActionType | null>(null);

  // Employee comment form state
  const [newComment, setNewComment] = useState('');

  // Employee cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Employee administrative override state
  const [showOverrideModal, setShowOverrideModal] = useState<'approve' | 'reject' | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideComment, setOverrideComment] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [reqRes, comRes] = await Promise.all([
        api.getRequestById(id),
        api.getComments(id),
      ]);
      setRequest(reqRes.data);
      setComments(comRes.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load request details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    window.scrollTo(0, 0);
  }, [loadData]);

  // Employee comment submission
  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim() || !id || isActionLoading) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await api.addComment(id, newComment.trim());
      setNewComment('');
      await loadData();
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
    } catch (err: any) {
      setActionError(err.message || 'Failed to post comment.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Employee submit / resubmit
  const handleSubmitRequest = async () => {
    if (!id) return;
    const isResubmit = request?.status === 'RETURNED';
    const message = isResubmit
      ? 'Resubmit this request for approval?'
      : 'Submit this request for approval? This will initiate the approval workflow.';

    if (!window.confirm(message)) return;

    try {
      setIsActionLoading(true);
      setActionError(null);
      await api.submitRequest(id);
      setActionSuccess(isResubmit ? 'Request resubmitted for approval.' : 'Request submitted for approval.');
      await loadData();
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit request.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Employee confirm cancel
  const handleConfirmCancel = async (reason: string) => {
    if (!id) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await api.cancelRequest(id, reason || undefined);
      setShowCancelModal(false);
      setActionSuccess('Request has been cancelled successfully.');
      await loadData();
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel request.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Administrative override execution (admin in employee mode)
  const handleExecuteOverride = async () => {
    if (!id || !showOverrideModal) return;
    if (!overrideReason.trim()) {
      setActionError('Administrative override requires an explicit justification reason.');
      return;
    }

    try {
      setIsActionLoading(true);
      setActionError(null);
      if (showOverrideModal === 'approve') {
        await api.approveRequest(id, overrideComment.trim() || undefined, {
          isOverride: true,
          overrideReason: overrideReason.trim(),
        });
        setActionSuccess('Administrative override: step approved.');
      } else if (showOverrideModal === 'reject') {
        await api.rejectRequest(id, overrideComment.trim() || overrideReason.trim(), {
          isOverride: true,
          overrideReason: overrideReason.trim(),
        });
        setActionSuccess('Administrative override: request rejected.');
      }
      setShowOverrideModal(null);
      setOverrideReason('');
      setOverrideComment('');
      await loadData();
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Administrative override failed.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const isHighValuePurchase = request?.type === 'PURCHASE' && Number(request?.purchaseDetail?.estimatedCost || 0) > 100000;
  const returnedLog = request?.auditLogs?.slice().reverse().find((l) => l.action === 'RETURNED');
  const canCancel = mode === 'employee' && request &&
    (request.status === 'DRAFT' || request.status === 'IN_REVIEW' || request.status === 'RETURNED') &&
    (request.requestedById === user?.id || user?.role === 'ADMIN');
  const canEditOrSubmit = mode === 'employee' && request &&
    (request.status === 'DRAFT' || request.status === 'RETURNED') && request.requestedById === user?.id;

  const isApproverActionable = mode === 'approver' && Boolean(request?.canAct && request?.status === 'IN_REVIEW');

  const getCommentAuthor = (actorId: string) => {
    if (actorId === user?.id) return 'You';
    if (actorId === request?.requestedById) {
      return request?.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName} (Requester)` : 'Requester';
    }
    const matchLog = request?.auditLogs?.find((l) => l.actorId === actorId && l.actor);
    if (matchLog && matchLog.actor) {
      return `${matchLog.actor.firstName} ${matchLog.actor.lastName} (${matchLog.actor.role.replace(/_/g, ' ')})`;
    }
    return `User …${actorId.slice(-6)}`;
  };

  const dashboardPath = mode === 'approver' ? '/approver' : '/dashboard';
  const breadcrumbSectionLabel = mode === 'approver' ? 'Approvals' : 'Dashboard';

  const estimatedCostValue = request?.type === 'PURCHASE' ? Number(request?.purchaseDetail?.estimatedCost || 0) : null;
  const formattedEstimatedCost = estimatedCostValue !== null && !isNaN(estimatedCostValue) && estimatedCostValue > 0
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(estimatedCostValue)
    : null;  return (
    <DashboardLayout
      title="MediFlow"
      isStickyHeader={false}
      actionBar={
        mode === 'approver' && isApproverActionable ? (
          <ActionBar
            canAct={isApproverActionable}
            isActionLoading={isActionLoading}
            onSelectAction={(action) => setActiveDecisionAction(action)}
          />
        ) : undefined
      }
      contentClassName="dashboard-main flex-1 w-full p-0"
    >
      <div className="details-page max-w-6xl mx-auto px-6 py-6">
        {isLoading ? (
          <LoadingState message="Loading request details..." />
        ) : error || !request ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center max-w-md mx-auto my-12 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">Request not found</h2>
            <p className="text-xs text-slate-500 mb-4">{error || 'The requested file or form does not exist.'}</p>
            <button
              type="button"
              onClick={() => navigate(dashboardPath)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              &larr; Back to {breadcrumbSectionLabel}
            </button>
          </div>
        ) : (
          <>
            {/* Top Compact Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs text-slate-500 mb-3" aria-label="Breadcrumb">
              <Link
                to={dashboardPath}
                className="hover:text-blue-700 transition-colors font-medium"
              >
                {breadcrumbSectionLabel}
              </Link>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-mono text-slate-800 font-semibold" aria-current="page">
                {request.referenceNumber}
              </span>
            </nav>

            {/* Page Header / Title Area */}
            <header className="mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                <div className="flex-1 min-w-0">
                  {/* Title row: Request title, single StatusChip, estimated amount */}
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                      {request.title}
                    </h1>
                    <StatusChip status={request.status} />
                    {formattedEstimatedCost && (
                      <span className="text-lg font-semibold tabular-nums text-slate-900">
                        {formattedEstimatedCost}
                      </span>
                    )}
                  </div>

                  {/* Subline: strictly Requester · Department · 24 Oct 2026, 5:57 PM */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    <span>
                      {request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : 'Requester'}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <span>
                      {request.department?.displayName || request.department?.name || 'Department'}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">·</span>
                    <time dateTime={request.createdAt}>
                      {fmtDateTime(request.createdAt)}
                    </time>
                  </div>
                </div>

                {/* Primary Action Buttons (Employee Mode: Edit / Submit / Cancel) */}
                {mode === 'employee' && (
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
                    {canEditOrSubmit && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/edit-request/${request.id}`)}
                          disabled={isActionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                          <span>Edit Request</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSubmitRequest}
                          disabled={isActionLoading}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md shadow-2xs transition-colors disabled:opacity-50"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>
                            {request.status === 'RETURNED' ? 'Resubmit for Approval' : 'Submit for Approval'}
                          </span>
                        </button>
                      </>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setShowCancelModal(true)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 rounded-md transition-colors disabled:opacity-50"
                        aria-label="Cancel this request"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span>Cancel request</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Action Banners */}
              {actionSuccess && (
                <div className="mt-3 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-md border border-emerald-200 flex items-center gap-2" role="alert">
                  <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="mt-3 p-3 bg-rose-50 text-rose-800 text-xs rounded-md border border-rose-200 flex items-center gap-2" role="alert">
                  <svg className="w-4 h-4 text-rose-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{actionError}</span>
                </div>
              )}

              {/* Status Notice Alerts (Employee Mode) */}
              {mode === 'employee' && request.status === 'DRAFT' && (
                <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div className="leading-relaxed">
                    <strong className="text-slate-900 font-semibold">Draft Request:</strong> This request has not yet been submitted into the approval workflow. Review your details below and click <strong className="text-slate-900">Submit for Approval</strong> when ready.
                  </div>
                </div>
              )}

              {request.status === 'RETURNED' && (
                <div className="mt-3 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Returned for Revision
                  </div>
                  <p className="text-amber-800 leading-relaxed mb-2">
                    This request was returned by an approver for corrections. Make updates using <strong className="text-amber-950 font-semibold">Edit Request</strong>, then click <strong className="text-amber-950 font-semibold">Resubmit for Approval</strong>.
                  </p>
                  {returnedLog?.description && (
                    <div className="bg-white/80 p-2.5 rounded border border-amber-200 text-slate-800 text-xs">
                      <span className="font-medium text-slate-600 text-xs block mb-0.5">Approver feedback</span>
                      <p className="italic">{returnedLog.description}</p>
                    </div>
                  )}
                </div>
              )}

              {isHighValuePurchase && (
                <div className="mt-3 p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-lg text-blue-950 text-xs flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center flex-shrink-0 text-xs">
                    ₹
                  </span>
                  <div>
                    <strong className="text-blue-900 font-semibold">Mandatory Finance Review Active:</strong> Requisitions exceeding ₹1,00,000 ({formattedEstimatedCost}) require Finance clearance as Step 1 per hospital administrative policy.
                  </div>
                </div>
              )}

              {mode === 'employee' && request.canAct && request.status === 'IN_REVIEW' && (
                <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>
                      <strong className="text-emerald-900 font-semibold">Action Required:</strong> You are authorized to review this step ({request.currentStep?.stepName || 'Current Stage'}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/approver/request/${request.id}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md shadow-2xs whitespace-nowrap transition-colors"
                  >
                    <span>Go to Review Actions</span>
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              )}

              {/* Administrative Override Governance (Admin only & IN_REVIEW in employee view) */}
              {mode === 'employee' && user?.role === 'ADMIN' && request.status === 'IN_REVIEW' && (
                <div className="mt-3 p-4 bg-slate-900 text-slate-100 rounded-lg border border-slate-800 shadow-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-slate-800">
                    <div>
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Administrative Override Governance
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Resolve reviewer unavailability or hospital deadlocks with explicit compliance audit tracking.
                      </p>
                    </div>
                  </div>

                  {!showOverrideModal ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors disabled:opacity-50"
                        disabled={isHighValuePurchase && request.currentStep?.approverRole === 'FINANCE_OFFICER'}
                        onClick={() => setShowOverrideModal('approve')}
                      >
                        Override &amp; Approve Step
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs font-semibold bg-rose-700 hover:bg-rose-600 text-white rounded-md transition-colors"
                        onClick={() => setShowOverrideModal('reject')}
                      >
                        Override &amp; Reject Request
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-slate-800/90 rounded border border-slate-700 text-xs">
                      <div className="font-bold text-white mb-2">
                        {showOverrideModal === 'approve'
                          ? `Confirm Override Approval for "${request.currentStep?.stepName || 'Current Stage'}"`
                          : 'Confirm Override Rejection'}
                      </div>
                      <div className="space-y-2 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Mandatory Justification Reason (Required for Compliance Audit)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Authorized per Medical Director instruction during clinical emergency..."
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Additional Comment (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Notes recorded in request timeline..."
                            value={overrideComment}
                            onChange={(e) => setOverrideComment(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`px-3 py-1.5 text-xs font-semibold text-white rounded transition-colors ${
                            showOverrideModal === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                          } disabled:opacity-50`}
                          disabled={!overrideReason.trim() || isActionLoading}
                          onClick={handleExecuteOverride}
                        >
                          {isActionLoading ? 'Executing Override…' : `Confirm Override ${showOverrideModal === 'approve' ? 'Approve' : 'Reject'}`}
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                          onClick={() => {
                            setShowOverrideModal(null);
                            setOverrideReason('');
                            setOverrideComment('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </header>

            {/* Main Responsive Grid Layout: 3 columns on lg, 1 column below lg */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* 1. Request Summary Card */}
              <section
                className="order-1 lg:order-none lg:col-span-2 lg:col-start-1 min-w-0 bg-white rounded-lg border border-slate-200 shadow-2xs"
                aria-labelledby="summary-heading"
              >
                {/* Standard Card Header: px-5 py-3 border-b border-slate-200 */}
                <div className="px-5 py-3 border-b border-slate-200">
                  <h2 id="summary-heading" className="text-sm font-semibold text-slate-900">
                    Request Summary
                  </h2>
                </div>

                {/* Standard Card Body: p-5 */}
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 text-xs">
                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Reference
                      </span>
                      <span className="font-mono text-sm text-slate-900 tabular-nums">
                        {request.referenceNumber}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Request type
                      </span>
                      <span className="text-sm text-slate-900 font-medium">
                        {getRequestTypeLabel(request.type)}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Department
                      </span>
                      <span className="text-sm text-slate-900">
                        {request.department?.displayName || request.department?.name || 'Hospital Department'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Priority
                      </span>
                      {request.priority === 'HIGH' ? (
                        <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                          High
                        </span>
                      ) : (
                        <span className="text-sm text-slate-900 capitalize">
                          {request.priority ? request.priority.toLowerCase() : 'Standard'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Workflow template
                      </span>
                      <span className="text-sm text-slate-900">
                        {request.workflowTemplate?.name ? `${request.workflowTemplate.name} (v${request.workflowTemplate.version || 1})` : 'Standard Approval Flow'}
                      </span>
                    </div>

                    <div>
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Current review state
                      </span>
                      <span className="text-sm text-slate-900">
                        {request.status === 'IN_REVIEW' ? (
                          request.assignedToUser ? (
                            <span>
                              Assigned to {request.assignedToUser.firstName} {request.assignedToUser.lastName} ({request.assignedToUser.roleRef?.displayName || request.assignedToUser.role.replace(/_/g, ' ')})
                            </span>
                          ) : (
                            <span>
                              Awaiting {request.currentStep?.stepName || 'Review'} ({request.currentStep?.approverRole.replace(/_/g, ' ')} Pool)
                            </span>
                          )
                        ) : (
                          getStatusLabel(request.status)
                        )}
                      </span>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                      <span className="text-xs font-medium text-slate-500 block mb-1">
                        Requester
                      </span>
                      <span className="text-sm text-slate-900">
                        {request.requestedBy
                          ? `${request.requestedBy.firstName} ${request.requestedBy.lastName} (${request.requestedBy.roleRef?.displayName || request.requestedBy.role.replace(/_/g, ' ')})`
                          : 'Hospital Staff'}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Approval Timeline: Single Render Responsive Strategy!
                  On < lg: order-2 displays it immediately after Request Summary, before Purchase Details.
                  On lg: col-start-3 row-start-1 row-span-6 sticky top-20 self-start pins it in right column. */}
              <aside className="order-2 lg:order-none lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:row-span-6 lg:sticky lg:top-20 lg:self-start min-w-0">
                <ApprovalTimeline request={request} />
              </aside>

              {/* 3. Type-Specific Details (Purchase Details) */}
              {request.type === 'PURCHASE' ? (
                request.purchaseDetail ? (
                  <div className="order-3 lg:order-none lg:col-span-2 lg:col-start-1 min-w-0">
                    <RequestTypeDetails request={request} />
                  </div>
                ) : null
              ) : (
                <div className="order-3 lg:order-none lg:col-span-2 lg:col-start-1 min-w-0">
                  <RequestTypeDetails request={request} />
                </div>
              )}

              {/* 4. Attachments — Read-only in Approver Mode */}
              <div className="order-4 lg:order-none lg:col-span-2 lg:col-start-1 min-w-0">
                <AttachmentList
                  requestId={request.id}
                  attachments={request.attachments || []}
                  canUpload={mode === 'employee' && request.status !== 'CANCELLED' && request.status !== 'REJECTED'}
                  canDelete={mode === 'employee' && (request.status === 'DRAFT' || request.status === 'RETURNED' || user?.role === 'ADMIN')}
                  currentUser={user}
                  onAttachmentsChanged={(newAtts) => {
                    setRequest((prev) => (prev ? { ...prev, attachments: newAtts } : null));
                  }}
                />
              </div>

              {/* 5. Activity Log */}
              <div className="order-5 lg:order-none lg:col-span-2 lg:col-start-1 min-w-0">
                <ActivityLog logs={request.auditLogs || []} />
              </div>

              {/* 6. Comments */}
              <section
                className="order-6 lg:order-none lg:col-span-2 lg:col-start-1 min-w-0 bg-white rounded-lg border border-slate-200 shadow-2xs"
                aria-labelledby="comments-heading"
              >
                {/* Standard Card Header */}
                <div className="px-5 py-3 border-b border-slate-200">
                  <h2 id="comments-heading" className="text-sm font-semibold text-slate-900">
                    Comments
                  </h2>
                </div>

                {/* Standard Card Body */}
                <div className="p-5">
                  {comments.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      No comments yet.
                    </div>
                  ) : (
                    <div className="space-y-3 mb-5">
                      {comments.map((c) => (
                        <div key={c.id} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                            <span className="font-semibold text-slate-900">
                              {getCommentAuthor(c.actorId)}
                            </span>
                            <time dateTime={c.createdAt} className="text-[11px] text-slate-400">
                              {fmtDateTime(c.createdAt)}
                            </time>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                            {c.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment Form — enabled for both approvers and employees when request is active */}
                  {request.status !== 'CANCELLED' && (
                    <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-100">
                      <label htmlFor="request-comment-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                        Add a comment
                      </label>
                      <textarea
                        id="request-comment-input"
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        disabled={isActionLoading}
                        placeholder="Type a message, note, or clinical context..."
                        className="w-full p-2.5 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 transition-all resize-none disabled:bg-slate-50"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          type="submit"
                          disabled={!newComment.trim() || isActionLoading}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-md shadow-2xs transition-colors disabled:opacity-50"
                        >
                          {isActionLoading ? 'Posting…' : 'Post comment'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            </div>
          </>
        )}

        {/* Approver Decision Modal */}
        {mode === 'approver' && request && activeDecisionAction && (
          <DecisionModal
            action={activeDecisionAction}
            request={request}
            isOpen={Boolean(activeDecisionAction)}
            onClose={() => setActiveDecisionAction(null)}
            onSuccess={(msg) => {
              setActionSuccess(msg);
              loadData();
              window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
              setTimeout(() => setActionSuccess(null), 5000);
            }}
          />
        )}

        {/* Employee Cancel Request Modal */}
        {mode === 'employee' && request && (
          <CancelRequestModal
            isOpen={showCancelModal}
            referenceNumber={request.referenceNumber}
            isSubmitting={isActionLoading}
            onConfirm={handleConfirmCancel}
            onClose={() => setShowCancelModal(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};
