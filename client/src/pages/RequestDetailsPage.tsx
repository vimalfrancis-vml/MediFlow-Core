import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type RequestItem, type CommentItem, type DocumentItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { NOTIFICATIONS_REFRESH_EVENT } from '../constants/notifications';
import { useAuth } from '../context/AuthContext';
import { WorkflowProgress } from '../components/WorkflowProgress';
import { AuditTimeline } from '../components/AuditTimeline';
import { RequestTypeDetails } from '../components/RequestTypeDetails';
import './RequestDetailsPage.css';

export default function RequestDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newComment, setNewComment] = useState('');
  const [docName, setDocName] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const [reqRes, comRes, docRes] = await Promise.all([
        api.getRequestById(id),
        api.getComments(id),
        api.getDocuments(id)
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

  const handleUploadDocument = async () => {
    if (!docName.trim() || !docUrl.trim() || !id) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await api.uploadDocument(id, docName, docUrl);
      setDocName('');
      setDocUrl('');
      await loadData();
    window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
    } catch (err: any) {
      setActionError(err.message || 'Failed to upload document.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      'Are you sure you want to submit this request for approval? This action cannot be undone.'
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

  return (
    <DashboardLayout title="Request Details">
      <div className="details-page">
        {isLoading ? (
          <LoadingState message="Loading request details..." />
        ) : error || !request ? (
          <div className="center-state">
            <div className="state-card error-state">
              <p>{error || 'Request not found'}</p>
              <button onClick={() => navigate('/dashboard')} className="retry-btn">Back to Dashboard</button>
            </div>
          </div>
        ) : (
          <>
            <header className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <button className="back-btn" onClick={() => navigate('/dashboard')}>
              &larr; Back to Dashboard
            </button>

          </div>
          <div className="details-header mb-6">
            <div className="dh-left">
              <span className="dh-ref">{request.referenceNumber}</span>
              <span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status.replace(/_/g, ' ')}</span>
            </div>
            <div className="dh-right">
              {request.type.replace(/_/g, ' ')}
            </div>
          </div>

          <WorkflowProgress request={request} />

          <div className="details-content">
            <h1>{request.title}</h1>
            <span className="request-date">Created on {new Date(request.createdAt).toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            {(request.status === 'DRAFT' || request.status === 'RETURNED') && request.requestedById === user?.id && (
              <button
                className="btn-submit"
                onClick={handleSubmitRequest}
                disabled={isActionLoading}
              >
                {isActionLoading
                  ? 'Submitting…'
                  : request.status === 'RETURNED'
                  ? 'Resubmit for Approval'
                  : 'Submit for Approval'}
              </button>
            )}
            {(request.status === 'DRAFT' || request.status === 'RETURNED') && request.requestedById === user?.id && (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/edit-request/${request.id}`)}
                disabled={isActionLoading}
                style={{ padding: '0.625rem 1.25rem', border: '1px solid #cbd5e1', borderRadius: 'var(--radius-md)', background: '#ffffff', color: '#475569', fontWeight: 'var(--weight-semibold)', cursor: 'pointer' }}
              >
                Edit Request
              </button>
            )}
          </div>
          {actionError && (
            <div className="inline-error" role="alert" style={{ marginTop: '0.75rem', color: '#f87171', fontSize: '0.875rem' }}>
              ✕ {actionError}
            </div>
          )}
        </header>

        <main className="details-grid">
          <div className="details-main-column">
            <section className="details-section">
              <h2>General Information</h2>
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
                  <span className="info-value">{request.department?.name || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Workflow Template</span>
                  <span className="info-value">{request.workflowTemplate?.name || 'N/A'}</span>
                </div>
              </div>
            </section>

            <RequestTypeDetails request={request} />

            <AuditTimeline logs={request.auditLogs || []} />

            <section className="details-section">
              <h2>Comments &amp; History</h2>
              {comments.length === 0 ? (
                <div className="empty-substate">No comments yet.</div>
              ) : (
                <div className="comments-list">
                  {comments.map(c => (
                    <div key={c.id} className="comment-card">
                      <div className="comment-header">
                      <span className="comment-author">
                          {c.actorId === user?.id ? 'You' : `User …${c.actorId.slice(-6)}`}
                        </span>
                        <span className="comment-date">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="comment-body">{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="add-comment-box">
                <textarea 
                  placeholder="Add a comment..." 
                  aria-label="Add a comment"
                  rows={3} 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  disabled={isActionLoading}
                />
                <button 
                  className="btn-secondary" 
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || isActionLoading}
                >
                  {isActionLoading ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </section>
          </div>

          <div className="details-sidebar">
            <section className="details-section">
              <h2>Documents</h2>
              {documents.length === 0 ? (
                <div className="empty-substate">No documents uploaded.</div>
              ) : (
                <ul className="document-list">
                  {documents.map(d => (
                    <li key={d.id} className="document-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                      <span>{d.fileName}</span>
                    </li>
                  ))}
                </ul>
              )}
              
              <div className="upload-box" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input 
                  type="text" 
                  placeholder="Document Name" 
                  aria-label="Document Name"
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  className="form-input"
                  disabled={isActionLoading}
                />
                <input 
                  type="url" 
                  placeholder="Document URL" 
                  aria-label="Document URL"
                  value={docUrl}
                  onChange={e => setDocUrl(e.target.value)}
                  className="form-input"
                  disabled={isActionLoading}
                />
                <button 
                  className="upload-btn" 
                  onClick={handleUploadDocument}
                  disabled={!docName.trim() || !docUrl.trim() || isActionLoading}
                >
                  {isActionLoading ? 'Uploading…' : '+ Upload Document'}
                </button>
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
