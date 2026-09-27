import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type RequestItem, type CommentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import { useAuth } from '../context/AuthContext';
import { useTerminology } from '../context/TerminologyContext';
import ActionModal from '../components/ActionModal';
import { ForwardModal } from '../components/ForwardModal';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { AuditTimeline } from '../components/AuditTimeline';
import { RequestTypeDetails } from '../components/RequestTypeDetails';
import { AttachmentManager } from '../components/AttachmentManager';
import { formatDate, formatDateTime } from '../utils/date';
import './ApproverDetailsPage.css';

type ModalAction = 'approve' | 'reject' | 'return' | null;

export default function ApproverDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();

  const [request, setRequest] = useState<RequestItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalAction>(null);
  const [showForwardModal, setShowForwardModal] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleAction = async (comment: string) => {
    if (!id || !activeModal) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      if (activeModal === 'approve') {
        await api.approveRequest(id, comment);
        setActionSuccess('Request approved successfully.');
      } else if (activeModal === 'reject') {
        await api.rejectRequest(id, comment);
        setActionSuccess('Request has been rejected.');
      } else if (activeModal === 'return') {
        await api.returnForCorrection(id, comment);
        setActionSuccess('Request returned to requester for changes.');
      }
      setActiveModal(null);
      await loadData(); // auto-refresh
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: any) {
      setActionError(err.message || 'Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const isActionable = Boolean(request?.canAct);
  const isHighValuePurchase = request?.type === 'PURCHASE' && Number(request?.purchaseDetail?.estimatedCost || 0) > 100000;
  const lastForwardLog = request?.auditLogs?.slice().reverse().find((l) => l.action === 'FORWARDED');

  const getCommentAuthor = (actorId: string) => {
    if (actorId === user?.id) return 'You';
    if (actorId === request?.requestedById) return 'Requester';
    const matchLog = request?.auditLogs?.find((l) => l.actorId === actorId && l.actor);
    if (matchLog && matchLog.actor) {
      return `${matchLog.actor.firstName} ${matchLog.actor.lastName} (${matchLog.actor.role.replace(/_/g, ' ')})`;
    }
    return `User …${actorId.slice(-6)}`;
  };

  return (
    <DashboardLayout title="MediFlow" brandPrefix="Approver">
      <div className="approver-details-page max-w-7xl mx-auto">
        {isLoading ? (
          <LoadingState message="Loading request..." />
        ) : error || !request ? (
          <div className="center-state">
            <div className="state-card error-state">
              <p>{error || 'Request not found.'}</p>
              <button onClick={() => navigate('/approver')} className="btn-secondary mt-4">
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Modal */}
            {activeModal && (
              <ActionModal
                action={activeModal}
                requestTitle={request.title}
                isLoading={isActionLoading}
                onConfirm={handleAction}
                onClose={() => setActiveModal(null)}
              />
            )}

            {/* Header */}
            <header className="ad-header mb-6">
              <div className="flex justify-between items-center w-full mb-3">
                <button
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
                  onClick={() => navigate('/approver')}
                >
                  &larr; Back to Pending Approvals
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  {request.workflowTemplate?.name || 'Standard Flow'} (v{request.workflowTemplate?.version || 1})
                </span>
              </div>

              <div className="ad-title-row flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{request.title}</h1>
                <span className={`status-badge status-${request.status.toLowerCase()}`}>
                  {getStatusLabel(request.status)}
                </span>
              </div>

              <div className="ad-meta flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-4">
                <span className="font-mono font-semibold px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                  {request.referenceNumber}
                </span>
                <span>•</span>
                <span>{formatDate(request.createdAt)}</span>
                <span>•</span>
                <span>{request.department?.displayName || request.department?.name || '—'}</span>
                <span>•</span>
                <span>Requester: <strong className="text-slate-700">{request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : 'Hospital Staff'}</strong></span>
                {request.status === 'IN_REVIEW' && (
                  <>
                    <span>•</span>
                    {request.assignedToUser ? (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 text-xs font-semibold rounded-md border border-amber-200 inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Assigned: <strong>{request.assignedToUser.firstName} {request.assignedToUser.lastName}</strong> ({request.assignedToUser.roleRef?.displayName || request.assignedToUser.role.replace(/_/g, ' ')}{request.assignedToUser.department ? ` - ${request.assignedToUser.department.displayName || request.assignedToUser.department.name}` : ''})
                        {lastForwardLog && (
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                            Forwarded
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-900 text-xs font-semibold rounded-md border border-blue-200">
                        Awaiting: {request.currentStep?.stepName} ({request.currentStep?.approverRole.replace(/_/g, ' ')} Pool)
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Policy Banners */}
              {isHighValuePurchase && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs sm:text-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 flex-shrink-0 text-sm">
                    ₹
                  </div>
                  <div>
                    <div className="font-bold text-emerald-900">Hospital Finance Review Policy Active</div>
                    <p className="text-emerald-800 mt-0.5">
                      This purchase requisition exceeds <strong>₹1,00,000</strong> ({new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(request.purchaseDetail?.estimatedCost || 0))}). Mandatory financial budget clearance is required as Step 1.
                    </p>
                  </div>
                </div>
              )}

              {/* Feedback Banners */}
              {actionError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200" role="alert">
                  ✕ {actionError}
                </div>
              )}

              {actionSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-xs rounded-md border border-emerald-200 font-semibold" role="alert">
                  ✓ {actionSuccess}
                </div>
              )}

              {/* Action Buttons Bar */}
              {isActionable && (
                <div className="ad-action-bar flex flex-wrap gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <button
                    id="btn-approve"
                    className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-sm"
                    onClick={() => setActiveModal('approve')}
                    disabled={isActionLoading}
                  >
                    ✓ Approve Request
                  </button>
                  <button
                    id="btn-forward"
                    className="btn-primary bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-sm"
                    onClick={() => setShowForwardModal(true)}
                    disabled={isActionLoading}
                  >
                    ↗ Forward / Reassign
                  </button>
                  <button
                    id="btn-return"
                    className="btn-secondary border-orange-300 text-orange-800 hover:bg-orange-50 font-semibold px-4 py-2 rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-sm"
                    onClick={() => setActiveModal('return')}
                    disabled={isActionLoading}
                  >
                    ↩ Return for Changes
                  </button>
                  <button
                    id="btn-reject"
                    className="btn-danger bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-md shadow-xs transition-colors flex items-center gap-1.5 text-sm"
                    onClick={() => setActiveModal('reject')}
                    disabled={isActionLoading}
                  >
                    ✕ Reject
                  </button>
                </div>
              )}
            </header>

            {/* Dynamic Forward Modal */}
            <ForwardModal
              requestId={request.id}
              requestTitle={request.title}
              stepName={request.currentStep?.stepName}
              isOpen={showForwardModal}
              onClose={() => setShowForwardModal(false)}
              onSuccess={(targetUser) => {
                setActionSuccess(`Request successfully forwarded to ${targetUser.firstName} ${targetUser.lastName}.`);
                loadData();
                setTimeout(() => setActionSuccess(null), 5000);
              }}
            />

            {/* Progress Workflow Bar */}
            <WorkflowProgress request={request} />

            {/* Main Details Grid */}
            <main className="ad-grid max-w-7xl mx-auto">
              <div className="ad-main-col">
                {/* Request Overview Card */}
                <section className="ad-section bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs mb-6">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    Request Details &amp; Responsibility
                  </h2>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Request Type</span>
                      <span className="info-value font-semibold">{getRequestTypeLabel(request.type)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Priority</span>
                      <span className="info-value font-medium">{request.priority}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Department</span>
                      <span className="info-value font-medium">{request.department?.displayName || request.department?.name || '—'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Current Stage</span>
                      <span className="info-value font-semibold text-indigo-700">
                        {request.status === 'IN_REVIEW'
                          ? (request.currentStep?.stepName || 'Under Review')
                          : getStatusLabel(request.status)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Current Assignee</span>
                      <span className="info-value font-medium">
                        {request.status === 'IN_REVIEW' ? (
                          request.assignedToUser ? (
                            <span>
                              {request.assignedToUser.firstName} {request.assignedToUser.lastName} ({request.assignedToUser.roleRef?.displayName || request.assignedToUser.role.replace(/_/g, ' ')})
                              {lastForwardLog && (
                                <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1 rounded font-bold">
                                  Reassigned
                                </span>
                              )}
                            </span>
                          ) : (
                            <span>Awaiting {request.currentStep?.stepName} ({request.currentStep?.approverRole.replace(/_/g, ' ')} Pool)</span>
                          )
                        ) : (
                          getStatusLabel(request.status)
                        )}
                      </span>
                    </div>
                  </div>
                </section>

                <RequestTypeDetails request={request} />

                {/* Attachments Section (Phase 6) */}
                <AttachmentManager
                  requestId={request.id}
                  initialAttachments={request.attachments || []}
                  canUpload={request.status === 'IN_REVIEW'}
                  canDelete={request.status === 'IN_REVIEW' || user?.role === 'ADMIN'}
                  currentUser={user}
                  onAttachmentsChanged={(newAtts) => {
                    setRequest((prev) => (prev ? { ...prev, attachments: newAtts } : null));
                  }}
                />

                <AuditTimeline logs={request.auditLogs || []} />

                {/* Comments Section */}
                <section className="ad-section bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs mb-6">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    Audit Notes &amp; Comments
                  </h2>
                  {comments.length === 0 ? (
                    <div className="empty-substate py-6 text-center text-slate-400 text-xs">No comments recorded.</div>
                  ) : (
                    <div className="comments-list space-y-3">
                      {comments.map((c) => (
                        <div key={c.id} className="comment-card bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/60">
                          <div className="comment-header flex justify-between items-center text-xs text-slate-500 mb-1.5">
                            <span className="comment-author font-semibold text-slate-800">
                              {getCommentAuthor(c.actorId)}
                            </span>
                            <span className="comment-date text-[11px]">{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p className="comment-body text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">{c.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Sidebar: Request Summary & Metadata */}
              <div className="ad-sidebar">
                <section className="ad-section bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs mb-4">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    Quick Reference
                  </h2>
                  <div className="space-y-3 text-xs sm:text-sm">
                    <div>
                      <span className="text-slate-500 block text-[11px] uppercase font-semibold">Reference</span>
                      <span className="font-mono font-bold text-slate-800">{request.referenceNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] uppercase font-semibold">Department</span>
                      <span className="font-medium text-slate-800">{request.department?.displayName || request.department?.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] uppercase font-semibold">Workflow Template</span>
                      <span className="font-medium text-slate-800">{request.workflowTemplate?.name} (v{request.workflowTemplate?.version || 1})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px] uppercase font-semibold">Total Attachments</span>
                      <span className="font-semibold text-slate-800">{(request.attachments || []).length} files</span>
                    </div>
                  </div>
                </section>
              </div>
            </main>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
