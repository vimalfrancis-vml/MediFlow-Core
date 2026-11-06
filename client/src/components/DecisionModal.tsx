import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api, type RequestItem, type RecipientItem } from '../services/api';

export type DecisionActionType = 'approve' | 'return' | 'reject' | 'reassign';

interface DecisionModalProps {
  action: DecisionActionType;
  request: RequestItem;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const ACTION_METADATA: Record<
  DecisionActionType,
  {
    title: string;
    description: string;
    confirmLabel: string;
    confirmButtonClass: string;
    commentLabel: string;
    commentPlaceholder: string;
    commentRequired: boolean;
    minCommentLength: number;
  }
> = {
  approve: {
    title: 'Approve Request',
    description: 'You are approving this request step. It will advance to the next stage in the approval workflow.',
    confirmLabel: 'Confirm Approval',
    confirmButtonClass: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    commentLabel: 'Decision note / comment (optional)',
    commentPlaceholder: 'Add any optional review notes or instructions...',
    commentRequired: false,
    minCommentLength: 0,
  },
  return: {
    title: 'Return Request for Changes',
    description: 'The request will be sent back to the requester for necessary revisions and corrections.',
    confirmLabel: 'Return for Changes',
    confirmButtonClass: 'bg-amber-600 hover:bg-amber-700 text-white',
    commentLabel: 'Reason for return and required corrections (required, min 10 characters)',
    commentPlaceholder: 'Specify clearly what corrections, missing documentation, or revisions are required...',
    commentRequired: true,
    minCommentLength: 10,
  },
  reject: {
    title: 'Reject Request',
    description: 'This request will be permanently rejected. The workflow will terminate and the requester will be notified.',
    confirmLabel: 'Confirm Rejection',
    confirmButtonClass: 'bg-rose-700 hover:bg-rose-800 text-white',
    commentLabel: 'Reason for rejection (required, min 10 characters)',
    commentPlaceholder: 'Explain the policy, budgetary, clinical, or administrative reason for rejection...',
    commentRequired: true,
    minCommentLength: 10,
  },
  reassign: {
    title: 'Reassign / Forward Request',
    description: 'Delegate or forward this review step to an eligible approver or colleague.',
    confirmLabel: 'Reassign Request',
    confirmButtonClass: 'bg-blue-700 hover:bg-blue-800 text-white',
    commentLabel: 'Reassignment handover note (optional)',
    commentPlaceholder: 'Add any handover notes or context for the reassigned reviewer...',
    commentRequired: false,
    minCommentLength: 0,
  },
};

export const DecisionModal: React.FC<DecisionModalProps> = ({
  action,
  request,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const meta = ACTION_METADATA[action];
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reassignment specific state
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [recipientQuery, setRecipientQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [recipientLoadError, setRecipientLoadError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Store trigger element focus to restore on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
      setComment('');
      setErrorMessage(null);
      setValidationError(null);
    } else {
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    }
  }, [isOpen]);

  // Load eligible recipients if action is reassign
  useEffect(() => {
    if (!isOpen || action !== 'reassign') return;

    let isMounted = true;
    async function fetchRecipients() {
      setIsLoadingRecipients(true);
      setRecipientLoadError(null);
      try {
        const res = await api.getEligibleRecipients(request.id);
        if (isMounted) {
          const list = res.data || [];
          setRecipients(list);
          if (list.length > 0) {
            setSelectedUserId(list[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setRecipientLoadError(err.message || 'Failed to load eligible reviewers.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecipients(false);
        }
      }
    }

    fetchRecipients();
    return () => {
      isMounted = false;
    };
  }, [isOpen, action, request.id]);

  // Focus trapping and keyboard management (Escape)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Focus comment textarea or first input on mount
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (action !== 'reassign' && commentInputRef.current) {
          commentInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, action]);

  // Distinct departments for reassign filtering
  const distinctDepartments = useMemo(() => {
    return Array.from(
      new Set(
        recipients
          .map((r) => r.department?.displayName || r.department?.name || r.department?.code)
          .filter(Boolean) as string[]
      )
    ).sort();
  }, [recipients]);

  // Filtered recipients
  const filteredRecipients = useMemo(() => {
    return recipients.filter((r) => {
      const deptName = r.department?.displayName || r.department?.name || r.department?.code || '';
      if (deptFilter !== 'ALL' && deptName !== deptFilter) return false;

      if (recipientQuery.trim()) {
        const q = recipientQuery.toLowerCase();
        const fullName = `${r.firstName || ''} ${r.lastName || ''}`.toLowerCase();
        const roleStr = (r.roleRef?.displayName || (r.role ? r.role.replace(/_/g, ' ') : '')).toLowerCase();
        const dStr = deptName.toLowerCase();
        return fullName.includes(q) || roleStr.includes(q) || dStr.includes(q);
      }
      return true;
    });
  }, [recipients, deptFilter, recipientQuery]);

  const effectiveSelectedId = useMemo(() => {
    if (filteredRecipients.length === 0) return '';
    if (filteredRecipients.some((r) => r.id === selectedUserId)) {
      return selectedUserId;
    }
    return filteredRecipients[0].id;
  }, [filteredRecipients, selectedUserId]);

  const selectedRecipient = useMemo(() => {
    return recipients.find((r) => r.id === effectiveSelectedId) || null;
  }, [recipients, effectiveSelectedId]);

  if (!isOpen) return null;

  const estimatedCost = request.type === 'PURCHASE' ? Number(request.purchaseDetail?.estimatedCost || 0) : null;
  const formattedCost = estimatedCost !== null && !isNaN(estimatedCost) && estimatedCost > 0
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(estimatedCost)
    : null;

  const validateComment = (text: string): boolean => {
    const trimmed = text.trim();
    if (meta.commentRequired) {
      if (!trimmed) {
        setValidationError('This action requires an explicit comment/reason.');
        return false;
      }
      if (trimmed.length < meta.minCommentLength) {
        setValidationError(`Comment must be at least ${meta.minCommentLength} characters long (currently ${trimmed.length}).`);
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComment(val);
    if (validationError) {
      validateComment(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateComment(comment)) {
      return;
    }

    if (action === 'reassign' && !effectiveSelectedId) {
      setValidationError('Please select an eligible recipient to reassign this request to.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const trimmedComment = comment.trim();

      if (action === 'approve') {
        await api.approveRequest(request.id, trimmedComment || undefined);
        onSuccess('Request approved successfully.');
      } else if (action === 'reject') {
        await api.rejectRequest(request.id, trimmedComment);
        onSuccess('Request has been rejected.');
      } else if (action === 'return') {
        await api.returnForCorrection(request.id, trimmedComment);
        onSuccess('Request returned to requester for revisions.');
      } else if (action === 'reassign') {
        await api.forwardRequest(request.id, effectiveSelectedId, trimmedComment || undefined);
        const name = selectedRecipient ? `${selectedRecipient.firstName} ${selectedRecipient.lastName}` : 'the designated reviewer';
        onSuccess(`Request successfully reassigned to ${name}.`);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Action failed. Please check your inputs and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      aria-hidden="false"
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-lg border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 text-left relative my-8"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-modal-title"
        aria-describedby="decision-modal-desc"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 id="decision-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
              {meta.title}
            </h2>
            <p id="decision-modal-desc" className="text-xs text-slate-500 mt-0.5">
              {meta.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Request Context Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-4 text-xs space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Request Ref
            </span>
            <span className="font-mono font-bold text-slate-900">
              {request.referenceNumber}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Title
            </span>
            <span className="font-medium text-slate-900 truncate max-w-[280px]" title={request.title}>
              {request.title}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              Requester
            </span>
            <span className="text-slate-700 font-medium">
              {request.requestedBy ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}` : 'Requester'}
              {request.department ? ` (${request.department.displayName || request.department.name})` : ''}
            </span>
          </div>
          {formattedCost && (
            <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-200/80">
              <span className="text-xs font-medium text-slate-500">
                Estimated Amount
              </span>
              <span className="font-mono font-bold text-slate-900">
                {formattedCost}
              </span>
            </div>
          )}
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-800 text-xs rounded-md border border-rose-200 flex items-start gap-2" role="alert">
            <svg className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Reassign Target Selection */}
          {action === 'reassign' && (
            <div className="mb-4 space-y-3">
              <div>
                <label htmlFor="reassign-filter" className="block text-xs font-semibold text-slate-700 mb-1">
                  Filter by Department
                </label>
                <select
                  id="reassign-filter"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  disabled={isLoadingRecipients || isSubmitting}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 disabled:bg-slate-50"
                >
                  <option value="ALL">All Departments ({distinctDepartments.length})</option>
                  {distinctDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="reassign-search" className="block text-xs font-semibold text-slate-700 mb-1">
                  Search Eligible Reviewers
                </label>
                <input
                  id="reassign-search"
                  type="text"
                  placeholder="Search by name, role, or clinical unit..."
                  value={recipientQuery}
                  onChange={(e) => setRecipientQuery(e.target.value)}
                  disabled={isLoadingRecipients || isSubmitting}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:border-blue-700 focus:ring-1 focus:ring-blue-700 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Recipient Reviewer <span className="text-rose-600">*</span>
                </label>

                {isLoadingRecipients ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200">
                    Loading eligible reviewers...
                  </div>
                ) : recipientLoadError ? (
                  <div className="p-3 text-xs text-rose-700 bg-rose-50 rounded-md border border-rose-200">
                    {recipientLoadError}
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200">
                    No eligible reviewers found matching your filter criteria.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
                    {filteredRecipients.map((rec) => {
                      const isSelected = rec.id === effectiveSelectedId;
                      const dept = rec.department?.displayName || rec.department?.name || rec.department?.code || '—';
                      const role = rec.roleRef?.displayName || rec.role.replace(/_/g, ' ');

                      return (
                        <label
                          key={rec.id}
                          className={`flex items-start gap-2.5 p-2.5 cursor-pointer text-xs transition-colors ${
                            isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="target-reviewer"
                            value={rec.id}
                            checked={isSelected}
                            onChange={() => setSelectedUserId(rec.id)}
                            disabled={isSubmitting}
                            className="mt-0.5 text-blue-700 focus:ring-blue-700"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {rec.firstName} {rec.lastName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {role} · {dept}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Comment Field */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="decision-comment-field" className="block text-xs font-semibold text-slate-700">
                {meta.commentLabel}
              </label>
              {meta.commentRequired && (
                <span className={`text-[10px] font-mono ${comment.trim().length >= meta.minCommentLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                  {comment.trim().length}/{meta.minCommentLength} min chars
                </span>
              )}
            </div>

            <textarea
              id="decision-comment-field"
              ref={commentInputRef}
              rows={4}
              value={comment}
              onChange={handleCommentChange}
              disabled={isSubmitting}
              placeholder={meta.commentPlaceholder}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? 'decision-comment-error' : undefined}
              className={`w-full p-2.5 text-xs sm:text-sm text-slate-900 bg-white border rounded-md focus:outline-none focus:ring-1 transition-all resize-none disabled:bg-slate-50 ${
                validationError
                  ? 'border-rose-400 focus:border-rose-600 focus:ring-rose-600'
                  : 'border-slate-300 focus:border-blue-700 focus:ring-blue-700'
              }`}
            />

            {validationError && (
              <p id="decision-comment-error" className="mt-1 text-xs text-rose-600 font-medium" role="alert">
                {validationError}
              </p>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || (action === 'reassign' && !effectiveSelectedId)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md shadow-2xs transition-colors disabled:opacity-50 ${meta.confirmButtonClass}`}
            >
              {isSubmitting && (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              )}
              <span>{isSubmitting ? 'Processing…' : meta.confirmLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
