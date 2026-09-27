import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type RequestItem, type CommentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import { useAuth } from '../context/AuthContext';
import { useTerminology } from '../context/TerminologyContext';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { AuditTimeline } from '../components/AuditTimeline';
import { RequestTypeDetails } from '../components/RequestTypeDetails';
import { AttachmentManager } from '../components/AttachmentManager';
import { formatDate, formatDateTime } from '../utils/date';
import './RequestDetailsPage.css';

export default function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();
  
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
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

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await api.addComment(id, newComment);
      setNewComment('');
      await loadData();
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
    } catch (err: any) {
      setActionError(err.message || 'Failed to add comment.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      'Are you sure you want to submit this request for approval? This will initiate the workflow.'
    );
    if (!confirmed) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await api.submitRequest(id);
      await loadData();
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit request.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const isHighValuePurchase = request?.type === 'PURCHASE' && Number(request?.purchaseDetail?.estimatedCost || 0) > 100000;
  const lastForwardLog = request?.auditLogs?.slice().reverse().find(l => l.action === 'FORWARDED');
  const returnedLog = request?.auditLogs?.slice().reverse().find(l => l.action === 'RETURNED');

  const getCommentAuthor = (actorId: string) => {
    if (actorId === user?.id) return 'You';
    if (actorId === request?.requestedById) return 'Requester';
    const matchLog = request?.auditLogs?.find(l => l.actorId === actorId && l.actor);
    if (matchLog && matchLog.actor) {
      return `${matchLog.actor.firstName} ${matchLog.actor.lastName} (${matchLog.actor.role.replace(/_/g, ' ')})`;
    }
    return `User …${actorId.slice(-6)}`;
  };

  return (
    <DashboardLayout title="Request Details">
      <div className="details-page max-w-7xl mx-auto">
        {isLoading ? (
          <LoadingState message="Loading request details..." />
        ) : error || !request ? (
          <div className="center-state">
            <div className="state-card error-state">
              <p>{error || 'Request not found'}</p>
              <button onClick={() => navigate('/dashboard')} className="btn-secondary mt-4">Back to Dashboard</button>
            </div>
          </div>
        ) : (
          <>
            <header className="page-header">
              <div className="flex justify-between items-center w-full mb-4">
                <button 
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 bg-white px-3 py-1.5 rounded-md border border-slate-200 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600" 
                  onClick={() => navigate('/dashboard')}
                >
                  &larr; Back to Dashboard
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  {request.workflowTemplate?.name || 'Standard Flow'} (v{request.workflowTemplate?.version || 1})
                </span>
              </div>

              <div className="details-header mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="dh-left flex items-center gap-3 flex-wrap">
                  <span className="dh-ref font-mono text-xs font-semibold px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-700">
                    {request.referenceNumber}
                  </span>
                  <span className={`status-badge status-${request.status.toLowerCase()}`}>
                    {getStatusLabel(request.status)}
                  </span>
                  {isHighValuePurchase && (
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                      ₹ Finance Policy Active
                    </span>
                  )}
                </div>
                <div className="dh-right text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
                  {getRequestTypeLabel(request.type)}
                </div>
              </div>

              <div className="details-content mb-4">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{request.title}</h1>
                <span className="request-date text-xs sm:text-sm text-slate-500 mt-1 block">
                  Created on {formatDate(request.createdAt)} by {request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : 'Requester'}
                </span>
                {request.status === 'IN_REVIEW' && (
                  <div className="mt-2 text-xs flex flex-wrap items-center gap-2">
                    {request.assignedToUser ? (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 font-semibold rounded-md border border-amber-200 inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                        Reassigned / Assigned to: <strong>{request.assignedToUser.firstName} {request.assignedToUser.lastName}</strong>
                        <span className="text-amber-700 font-normal">
                          ({request.assignedToUser.roleRef?.displayName || request.assignedToUser.role.replace(/_/g, ' ')}{request.assignedToUser.department ? ` - ${request.assignedToUser.department.displayName || request.assignedToUser.department.name}` : ''})
                        </span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-900 font-semibold rounded-md border border-blue-200 inline-flex items-center gap-1.5">
                        Awaiting Review: <strong>{request.currentStep?.stepName || 'Current Stage'}</strong> ({request.currentStep?.approverRole.replace(/_/g, ' ')} Pool)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Status Alert Banners */}
              {request.status === 'DRAFT' && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs sm:text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <strong>Draft Request:</strong> This request has not yet been submitted into the approval workflow. Review your details below and click <strong>Submit for Approval</strong> when ready.
                  </div>
                </div>
              )}

              {request.status === 'RETURNED' && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-950 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 font-bold text-orange-900 mb-1">
                    <svg className="w-5 h-5 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Returned for Revision
                  </div>
                  <p className="text-orange-800 mb-2">
                    This request was returned by an approver for corrections. Make updates using <strong>Edit Request</strong>, then click <strong>Resubmit for Approval</strong>.
                  </p>
                  {returnedLog?.description && (
                    <div className="bg-white/80 p-2.5 rounded-md border border-orange-200 text-slate-800 font-mono text-xs">
                      <strong>Approver Feedback:</strong> {returnedLog.description}
                    </div>
                  )}
                </div>
              )}

              {isHighValuePurchase && (
                <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs sm:text-sm flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 flex-shrink-0 text-sm">
                    ₹
                  </div>
                  <div>
                    <div className="font-bold text-emerald-900">Mandatory Finance Review Required</div>
                    <p className="text-emerald-800 mt-0.5">
                      Because this purchase requisition exceeds <strong>₹1,00,000</strong> ({new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(request.purchaseDetail?.estimatedCost || 0))}), hospital policy requires Finance clearance as Step 1 before departmental review.
                    </p>
                  </div>
                </div>
              )}

              {request.canAct && request.status === 'IN_REVIEW' && (
                <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-950 text-xs sm:text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <strong className="text-indigo-900">Action Required:</strong> You are authorized to review this step ({request.currentStep?.stepName || 'Current Stage'}).
                  </div>
                  <button
                    className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                    onClick={() => navigate(`/approver/request/${request.id}`)}
                  >
                    Go to Review Actions &rarr;
                  </button>
                </div>
              )}

              {/* Action Bar for Requester */}
              {(request.status === 'DRAFT' || request.status === 'RETURNED') && request.requestedById === user?.id && (
                <div className="flex flex-wrap gap-3 mt-4 mb-2">
                  <button
                    className="btn-primary"
                    onClick={handleSubmitRequest}
                    disabled={isActionLoading}
                  >
                    {isActionLoading
                      ? 'Submitting…'
                      : request.status === 'RETURNED'
                      ? '✓ Resubmit for Approval'
                      : '✓ Submit for Approval'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => navigate(`/edit-request/${request.id}`)}
                    disabled={isActionLoading}
                  >
                    ✎ Edit Request
                  </button>
                </div>
              )}

              {actionError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200" role="alert">
                  ✕ {actionError}
                </div>
              )}
            </header>

            {/* Workflow Progress Bar */}
            <WorkflowProgress request={request} />

            <main className="details-grid">
              <div className="details-main-column">
                {/* General Information Card */}
                <section className="details-section bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs mb-6">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    General Information
                  </h2>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Type</span>
                      <span className="info-value font-medium">{getRequestTypeLabel(request.type)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Priority</span>
                      <span className="info-value font-medium">{request.priority}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Department</span>
                      <span className="info-value font-medium">{request.department?.displayName || request.department?.name || 'N/A'}</span>
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
                      <span className="info-label">Current Responsibility</span>
                      <span className="info-value font-medium">
                        {request.status === 'IN_REVIEW' ? (
                          request.assignedToUser ? (
                            <span>
                              Assigned to {request.assignedToUser.firstName} {request.assignedToUser.lastName} ({request.assignedToUser.roleRef?.displayName || request.assignedToUser.role.replace(/_/g, ' ')})
                              {lastForwardLog && (
                                <span className="ml-1.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded font-semibold">
                                  Reassigned
                                </span>
                              )}
                            </span>
                          ) : (
                            <span>Awaiting {request.currentStep?.stepName || 'Approval'} ({request.currentStep?.approverRole.replace(/_/g, ' ')} Pool)</span>
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
                  canUpload={request.status !== 'CANCELLED' && request.status !== 'REJECTED'}
                  canDelete={request.status === 'DRAFT' || request.status === 'RETURNED' || user?.role === 'ADMIN'}
                  currentUser={user}
                  onAttachmentsChanged={(newAtts) => {
                    setRequest((prev) => (prev ? { ...prev, attachments: newAtts } : null));
                  }}
                />

                <AuditTimeline logs={request.auditLogs || []} />

                {/* Comments Section */}
                <section className="details-section bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs mb-6">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 pb-3 border-b border-slate-100">
                    Comments &amp; Discussion
                  </h2>
                  {comments.length === 0 ? (
                    <div className="empty-substate py-6 text-center text-slate-400 text-xs">No comments recorded yet.</div>
                  ) : (
                    <div className="comments-list space-y-3 mb-4">
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
                  
                  <div className="add-comment-box flex flex-col gap-2 pt-2 border-t border-slate-100">
                    <label htmlFor="requester-comment" className="text-xs font-semibold text-slate-700">Add a note</label>
                    <textarea 
                      id="requester-comment"
                      placeholder="Type a message or response..." 
                      rows={3} 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      disabled={isActionLoading}
                      className="w-full p-2.5 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="flex justify-end">
                      <button 
                        className="btn-secondary text-xs" 
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || isActionLoading}
                      >
                        {isActionLoading ? 'Posting…' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sidebar: Request Summary & Metadata */}
              <div className="details-sidebar">
                <section className="details-section bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs mb-4">
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
