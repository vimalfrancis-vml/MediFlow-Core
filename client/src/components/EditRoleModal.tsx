import { useState, useEffect, useRef, type FC, type FormEvent } from 'react';
import { api, type RoleItem } from '../services/api';

export interface EditRoleModalProps {
  isOpen: boolean;
  role: RoleItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const EditRoleModal: FC<EditRoleModalProps> = ({
  isOpen,
  role,
  onClose,
  onSuccess,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  // Validation & Submission States
  const [errors, setErrors] = useState<{ displayName?: string; description?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Focus management refs
  const modalRef = useRef<HTMLDivElement>(null);
  const displayNameInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Sync role data on open
  useEffect(() => {
    if (isOpen && role) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setDisplayName(role.displayName || '');
      setDescription(role.description || '');
      setErrors({});
      setSubmitError(null);

      setTimeout(() => {
        displayNameInputRef.current?.focus();
        displayNameInputRef.current?.select();
      }, 50);
    } else {
      previousActiveElement.current?.focus();
    }
  }, [isOpen, role]);

  // Handle Escape key and focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !role) return null;

  const validate = (): boolean => {
    const newErrors: { displayName?: string; description?: string } = {};

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      newErrors.displayName = 'Display name is required.';
    } else if (trimmedName.length > 60) {
      newErrors.displayName = 'Display name must be 60 characters or fewer.';
    }

    if (description.length > 200) {
      newErrors.description = 'Description must be 200 characters or fewer.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await api.updateRole(role.id, {
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      });

      onSuccess(`Role "${role.code}" updated successfully.`);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to update role details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4 overflow-y-auto"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-role-modal-title"
        className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-6 text-left relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 id="edit-role-modal-title" className="text-base font-bold text-slate-900">
              Edit role
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update user-facing title and description
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Global Submit Error Message */}
        {submitError && (
          <div className="mb-4 p-3 bg-rose-50 text-rose-700 text-xs rounded-md border border-rose-200 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{submitError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field 1: Role Code (Read-only) */}
          <div>
            <label
              htmlFor="edit-role-code"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Role code <span className="text-slate-400 font-normal">(System immutable)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                id="edit-role-code"
                type="text"
                readOnly
                disabled
                value={role.code}
                className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono font-semibold text-slate-600 cursor-not-allowed select-all"
                title="System code cannot be changed"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              System codes are immutable to protect workflow authorization and audit history.
            </p>
          </div>

          {/* Field 2: Display Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="edit-role-display-name"
                className="block text-xs font-medium text-slate-700"
              >
                Display name <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {displayName.trim().length} / 60
              </span>
            </div>
            <input
              id="edit-role-display-name"
              ref={displayNameInputRef}
              type="text"
              required
              maxLength={60}
              disabled={isSubmitting}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (errors.displayName) setErrors((prev) => ({ ...prev, displayName: undefined }));
              }}
              placeholder="e.g. Head of Department"
              className={`w-full h-10 px-3 bg-white border rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors ${
                errors.displayName
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                  : 'border-slate-300'
              }`}
              aria-describedby={errors.displayName ? 'edit-role-name-error' : undefined}
              aria-invalid={Boolean(errors.displayName)}
            />
            {errors.displayName && (
              <p id="edit-role-name-error" className="text-[11px] text-rose-600 mt-1">
                {errors.displayName}
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Shown across user assignment forms, approval step headers, and listings.
            </p>
          </div>

          {/* Field 3: Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="edit-role-description"
                className="block text-xs font-medium text-slate-700"
              >
                Description <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {description.length} / 200
              </span>
            </div>
            <textarea
              id="edit-role-description"
              rows={3}
              maxLength={200}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="Describe the responsibilities and authority of this role..."
              className={`w-full p-2.5 bg-white border rounded-md text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors resize-none ${
                errors.description
                  ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                  : 'border-slate-300'
              }`}
              aria-describedby={errors.description ? 'edit-role-desc-error' : undefined}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description && (
              <p id="edit-role-desc-error" className="text-[11px] text-rose-600 mt-1">
                {errors.description}
              </p>
            )}
          </div>

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
              type="submit"
              disabled={isSubmitting}
              className="h-10 px-4 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-2xs transition-colors inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

