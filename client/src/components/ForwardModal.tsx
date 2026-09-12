import React, { useState, useEffect } from 'react';
import { api, type RecipientItem } from '../services/api';

interface ForwardModalProps {
  requestId: string;
  requestTitle: string;
  stepName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetUser: RecipientItem) => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  requestId,
  requestTitle,
  stepName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadRecipients() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.getEligibleRecipients(requestId);
        if (isMounted) {
          setRecipients(res.data || []);
          if (res.data && res.data.length > 0) {
            setSelectedUserId(res.data[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load eligible recipients.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadRecipients();
    return () => {
      isMounted = false;
    };
  }, [isOpen, requestId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select a recipient.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.forwardRequest(requestId, selectedUserId, comment.trim() || undefined);
      const chosen = recipients.find((r) => r.id === selectedUserId)!;
      onSuccess(chosen);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to forward request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={() => { if (!isSubmitting) onClose(); }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left relative border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-modal-title"
      >
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 id="forward-modal-title" className="text-lg font-bold text-slate-900">Forward / Assign Request</h3>
            <p className="text-xs text-slate-500 font-medium truncate max-w-xs">{requestTitle}</p>
            {stepName && <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{stepName}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-600 mb-4">
          Assign this approval step to another authorized officer. The workflow will remain in its current stage until the new assignee acts.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-6 text-center text-sm text-slate-500">Loading eligible personnel...</div>
        ) : recipients.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-700">No other eligible recipients available.</p>
            <p className="text-xs text-slate-400 mt-1">There are no other active officers matching the required role and departmental authorization for this stage.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Assignee <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
              >
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.firstName} {r.lastName} — {r.roleRef?.displayName || r.role.replace(/_/g, ' ')} ({r.department?.displayName || r.department?.name || r.department?.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forwarding Note / Instruction <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Explain why this request is being forwarded..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? 'Forwarding...' : 'Confirm Forward'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
