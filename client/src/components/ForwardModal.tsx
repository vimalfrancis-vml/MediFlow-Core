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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
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
      setSearchQuery('');
      setDepartmentFilter('ALL');
      try {
        const res = await api.getEligibleRecipients(requestId);
        if (isMounted) {
          const list = res.data || [];
          setRecipients(list);
          if (list.length > 0) {
            setSelectedUserId(list[0].id);
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

  // Extract distinct departments for filtering
  const departments = Array.from(
    new Set(
      recipients
        .map((r) => r.department?.displayName || r.department?.name || r.department?.code)
        .filter(Boolean) as string[]
    )
  ).sort();

  // Filtered recipients based on search query and department filter
  const filteredRecipients = recipients.filter((r) => {
    const deptName = r.department?.displayName || r.department?.name || r.department?.code || '';
    if (departmentFilter !== 'ALL' && deptName !== departmentFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
      const roleStr = (r.roleRef?.displayName || r.role).toLowerCase();
      const deptStr = deptName.toLowerCase();
      return fullName.includes(q) || roleStr.includes(q) || deptStr.includes(q);
    }
    return true;
  });

  useEffect(() => {
    if (filteredRecipients.length > 0) {
      const exists = filteredRecipients.some((r) => r.id === selectedUserId);
      if (!exists) {
        setSelectedUserId(filteredRecipients[0].id);
      }
    } else {
      setSelectedUserId('');
    }
  }, [filteredRecipients, selectedUserId]);

  const selectedRecipient = recipients.find((r) => r.id === selectedUserId);

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
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 text-left relative border border-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-modal-title"
      >
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 id="forward-modal-title" className="text-lg font-bold text-slate-900">Forward / Dynamic Reassign</h3>
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
          Select an authorized hospital officer or department recipient for information, action, quotation, or review. 
          The request will be reassigned at the current stage without advancing or approving the workflow.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-md border border-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading authorized personnel...</div>
        ) : recipients.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-700">No other eligible recipients available.</p>
            <p className="text-xs text-slate-400 mt-1">There are no other active authorized officers available for reassignment at this stage.</p>
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
            {/* Search and Department Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Search Officer
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type name, role, department..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500"
                />
              </div>
              {departments.length > 1 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="ALL">All Departments ({recipients.length})</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Recipient Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Recipient <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
              >
                {filteredRecipients.length === 0 ? (
                  <option value="" disabled>No recipients match search filter</option>
                ) : (
                  filteredRecipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.firstName} {r.lastName} — {r.roleRef?.displayName || r.role.replace(/_/g, ' ')} ({r.department?.displayName || r.department?.name || r.department?.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Selected Recipient Summary Card */}
            {selectedRecipient && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-xs">
                <div className="font-semibold text-indigo-950 flex items-center justify-between">
                  <span>Selected Assignee:</span>
                  <span className="font-mono text-[11px] text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded">
                    {selectedRecipient.department?.displayName || selectedRecipient.department?.name || selectedRecipient.department?.code}
                  </span>
                </div>
                <div className="mt-1 text-slate-800 font-medium">
                  {selectedRecipient.firstName} {selectedRecipient.lastName} — {selectedRecipient.roleRef?.displayName || selectedRecipient.role.replace(/_/g, ' ')}
                </div>
                <p className="mt-1.5 text-[11px] text-indigo-800">
                  This request will appear in <strong>{selectedRecipient.firstName} {selectedRecipient.lastName}&apos;s</strong> pending review queue.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forwarding Note / Reason <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Reason or instructions for forwarding (e.g., Please review specification and provide quotation)..."
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
                disabled={isSubmitting || !selectedUserId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
