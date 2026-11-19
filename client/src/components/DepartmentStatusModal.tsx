import { useState, useEffect, useRef, type FC } from 'react';
import { api, type DepartmentItem } from '../services/api';

export interface DepartmentStatusModalProps {
  isOpen: boolean;
  department: DepartmentItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const DepartmentStatusModal: FC<DepartmentStatusModalProps> = ({
  isOpen,
  department,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !department) return null;

  const isDeactivating = department.isActive;
  const isProtectedCoreDept = ['CARD', 'FIN', 'HR'].includes(department.code);
  const openRequestsCount = department._count?.requests || 0;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const nextStatus = !department.isActive;
      await api.setDepartmentStatus(department.id, nextStatus);
      onSuccess(
        `Department '${department.name}' successfully ${
          nextStatus ? 'activated' : 'deactivated'
        }.`
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          `Failed to ${isDeactivating ? 'deactivate' : 'activate'} department.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dept-status-title"
        className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 text-left relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Icon & Title */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDeactivating ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isDeactivating ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div>
            <h2 id="dept-status-title" className="text-base font-bold text-slate-900">
              {isDeactivating ? 'Deactivate department' : 'Activate department'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {department.name} ({department.code})
            </p>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-md border border-rose-200 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Warning Details for Deactivation */}
        {isDeactivating ? (
          <div className="space-y-3 text-xs text-slate-600 mb-6">
            <p>
              Are you sure you want to deactivate <strong className="text-slate-900">{department.name}</strong>?
            </p>

            {isProtectedCoreDept && (
              <div className="p-3 bg-amber-50 text-amber-800 rounded-md border border-amber-200 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>
                  <strong>Core System Department:</strong> {department.name} ({department.code}) is configured for system routing. The backend may reject deactivation if active workflows depend on it.
                </span>
              </div>
            )}

            {openRequestsCount > 0 && (
              <div className="p-3 bg-amber-50 text-amber-800 rounded-md border border-amber-200 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>
                  This department currently has <strong className="font-semibold">{openRequestsCount}</strong> active request(s) under review.
                </span>
              </div>
            )}

            <p className="text-slate-500">
              Deactivated departments are hidden from new request forms and routing menus. Existing historical records remain preserved.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-xs text-slate-600 mb-6">
            <p>
              Reactivating <strong className="text-slate-900">{department.name}</strong> will restore it to active status, allowing employees to select it for new requests and workflow routing.
            </p>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`h-10 px-4 rounded-md text-white text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isDeactivating
                ? 'bg-rose-600 hover:bg-rose-700 focus-visible:outline-rose-600'
                : 'bg-blue-700 hover:bg-blue-800 focus-visible:outline-blue-700'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : isDeactivating ? (
              'Deactivate'
            ) : (
              'Activate'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

