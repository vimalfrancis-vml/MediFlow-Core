import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type RequestItem, type CommentItem, type DocumentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import ActionModal from '../components/ActionModal';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { AuditTimeline } from '../components/AuditTimeline';
import { RequestTypeDetails } from '../components/RequestTypeDetails';
import { useAuth } from '../context/AuthContext';
import './ApproverDetailsPage.css';

type ModalAction = 'approve' | 'reject' | 'return' | null;

export default function ApproverDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [request, setRequest] = useState<RequestItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalAction>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [reqRes, comRes, docRes] = await Promise.all([
        api.getRequestById(id),
        api.getComments(id),
        api.getDocuments(id),
      ]);
      setRequest(reqRes.data);
      setComments(comRes.data || []);
      setDocuments(docRes.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load request details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
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
      // Dispatch notification refresh event
      window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
      // Auto-dismiss success banner after 4 seconds
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Action failed. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const isActionable = 
    request?.status === 'IN_REVIEW' &&
    request?.currentStep &&
    user?.role === request.currentStep.approverRole &&
    (user?.role !== 'HOD' || user?.departmentCode === request.department?.code);

  return (
    <DashboardLayout title="MediFlow" brandPrefix="Approver">
      <div className="approver-details-page">
        {isLoading ? (
          <LoadingState message="Loading request..." />
        ) : error || !request ? (
          <div className="center-state">
            <div className="state-card error-state">
              <p>{error || 'Request not found.'}</p>
              <button onClick={() => navigate('/approver')} className="retry-btn">Back to Dashboard</button>
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
            <header className="ad-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
                <button className="back-btn" onClick={() => navigate('/approver')}>
                  &larr; Back to Pending Approvals
                </button>
              </div>
        
        <div className="ad-title-row">
          <h1>{request.title}</h1>
          <span className={`request-status status-${request.status.toLowerCase()}`}>
            {request.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="ad-meta">
          <span className="request-ref">{request.referenceNumber}</span>
          <span>•</span>
          <span>{new Date(request.createdAt).toLocaleDateString()}</span>
          <span>•</span>
          <span>{request.department?.name || '—'}</span>
        </div>

        {/* Error banner */}
        {actionError && (
          <div className="error-banner" role="alert">
            ✕ {actionError}
          </div>
        )}

        {/* Success banner */}
        {actionSuccess && (
          <div className="success-banner">
            ✓ {actionSuccess}
          </div>
        )}

        {/* Action Buttons — only when IN_REVIEW */}
        {isActionable && (
          <div className="ad-action-bar">
            <button
              id="btn-approve"
              className="ad-btn ad-btn-approve"
              onClick={() => setActiveModal('approve')}
            >
              ✓ Approve
            </button>
            <button
              id="btn-return"
              className="ad-btn ad-btn-return"
              onClick={() => setActiveModal('return')}
            >
              ↩ Return for Changes
            </button>
            <button
              id="btn-reject"
              className="ad-btn ad-btn-reject"
              onClick={() => setActiveModal('reject')}
            >
              ✕ Reject
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <main className="ad-grid max-w-7xl mx-auto">
        <div className="ad-main-col">
          <WorkflowProgress request={request} />

          {/* Request Info */}
          <section className="ad-section">
            <h2>Request Details</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Type</span>
                <span className="info-value">{request.type}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Priority</span>
                <span className="info-value">{request.priority}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Department</span>
                <span className="info-value">{request.department?.name || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Workflow</span>
                <span className="info-value">{request.workflowTemplate?.name || '—'}</span>
              </div>
            </div>
          </section>

          <RequestTypeDetails request={request} />

          <AuditTimeline logs={request.auditLogs || []} />

          <section className="ad-section">
            <h2>Comments & History</h2>
            {comments.length === 0 ? (
              <div className="empty-substate">No comments yet.</div>
            ) : (
              <div className="comments-list">
                {comments.map(c => (
                  <div key={c.id} className="comment-card">
                    <div className="comment-header">
                    <span className="comment-author">
                        User …{c.actorId.slice(-6)}
                      </span>
                      <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="comment-body">{c.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="ad-sidebar">
          <section className="ad-section">
            <h2>Documents</h2>
            {documents.length === 0 ? (
              <div className="empty-substate">No documents attached.</div>
            ) : (
              <ul className="document-list">
                {documents.map(d => (
                  <li key={d.id} className="document-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <a href={d.url} target="_blank" rel="noopener noreferrer">{d.fileName}</a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
        )}
      </div>
    </DashboardLayout>
  );
}
