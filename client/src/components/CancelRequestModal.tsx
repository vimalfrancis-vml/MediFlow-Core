import React, { useState, useEffect, useRef } from 'react';

interface CancelRequestModalProps {
  isOpen: boolean;
  referenceNumber: string;
  isSubmitting?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

export const CancelRequestModal: React.FC<CancelRequestModalProps> = ({
  isOpen,
  referenceNumber,
  isSubmitting = false,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const modalRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Capture previously focused element when opened & restore on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
      // Focus textarea on modal open
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    } else {
      previouslyFocusedElementRef.current?.focus();
      setReason('');
    }
  }, [isOpen]);

  // Handle escape key
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      aria-describedby="cancel-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden animate-scaleIn"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 id="cancel-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
                Cancel Request
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {referenceNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5">
          <p id="cancel-modal-description" className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
            Are you sure you want to cancel this request? Once cancelled, it will be withdrawn from the approval workflow and cannot be reviewed further.
          </p>

          <div className="mb-4">
            <label htmlFor="cancel-reason" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Cancellation Reason <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="cancel-reason"
              ref={textareaRef}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Request is no longer needed, duplicate entry, or budget revised..."
              className="w-full p-2.5 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#2457A7] focus:ring-1 focus:ring-[#2457A7] transition-all resize-none disabled:bg-slate-50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
            >
              Keep request
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-2xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Cancelling…</span>
                </>
              ) : (
                <span>Cancel request</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
