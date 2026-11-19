import { useState, useEffect, useRef, type FC, type FormEvent } from 'react';
import { api, type DepartmentItem, type UserItem } from '../services/api';

export interface DepartmentModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  department?: DepartmentItem | null;
  existingDepartments: DepartmentItem[];
  users: UserItem[];
  isUsersLoading?: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const DepartmentModal: FC<DepartmentModalProps> = ({
  isOpen,
  mode,
  department,
  existingDepartments,
  users,
  isUsersLoading = false,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [hodId, setHodId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Validation & Submission States
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // DOM Refs for accessibility focus trap
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Initialize or reset form fields on open/change
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      setErrors({});
      setSubmitError(null);

      if (mode === 'edit' && department) {
        setName(department.name || '');
        setCode(department.code || '');
        setDisplayName(department.displayName || '');
        setHodId(department.hod?.id || '');
        setIsActive(department.isActive ?? true);
      } else {
        setName('');
        setCode('');
        setDisplayName('');
        setHodId('');
        setIsActive(true);
      }

      // Focus first editable input
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 50);
    } else {
      // Restore focus on close
      previousActiveElement.current?.focus();
    }
  }, [isOpen, mode, department]);

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

  if (!isOpen) return null;

  // Validation handler
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Department name is required.';
    }

    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      newErrors.code = 'Department code is required.';
    } else if (trimmedCode.length < 2 || trimmedCode.length > 10) {
      newErrors.code = 'Code must be between 2 and 10 uppercase letters.';
    } else if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
      newErrors.code = 'Code must contain only letters, numbers, and dashes.';
    } else if (mode === 'create') {
      // Frontend uniqueness pre-check
      const duplicate = existingDepartments.find(
        (d) => d.code.toUpperCase() === trimmedCode
      );
      if (duplicate) {
        newErrors.code = `Department code '${trimmedCode}' is already in use by '${duplicate.name}'.`;
      }
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
      if (mode === 'create') {
        const payload = {
          name: name.trim(),
          code: code.trim().toUpperCase(),
          displayName: displayName.trim() || undefined,
          hodId: hodId || null,
        };
        await api.createDepartment(payload);
        onSuccess(`Department '${name.trim()}' created successfully.`);
      } else if (mode === 'edit' && department) {
        const payload = {
          name: name.trim(),
          displayName: displayName.trim() || undefined,
          hodId: hodId || null,
          isActive,
        };
        await api.updateDepartment(department.id, payload);
        onSuccess(`Department '${name.trim()}' updated successfully.`);
      }
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to save department details.');
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
        aria-labelledby="dept-modal-title"
        className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 text-left relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h2 id="dept-modal-title" className="text-base font-bold text-slate-900">
              {mode === 'create' ? 'Create department' : 'Edit department'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'create'
                ? 'Register a new hospital department and assign leadership'
                : `Update configuration and HOD for ${department?.name || 'department'}`}
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
          {/* Department Code & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Department Code */}
            <div className="sm:col-span-1">
              <label htmlFor="dept-code-input" className="block text-xs font-medium text-slate-700 mb-1">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                id="dept-code-input"
                ref={mode === 'create' ? firstInputRef : undefined}
                type="text"
                disabled={mode === 'edit' || isSubmitting}
                placeholder="e.g. CARD"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
                }}
                maxLength={10}
                className={`w-full h-10 px-3 bg-white border rounded-md text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors ${
                  mode === 'edit'
                    ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed'
                    : errors.code
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300'
                }`}
                aria-describedby={errors.code ? 'dept-code-error' : undefined}
                aria-invalid={Boolean(errors.code)}
              />
              {errors.code && (
                <p id="dept-code-error" className="text-[11px] text-rose-600 mt-1">
                  {errors.code}
                </p>
              )}
            </div>

            {/* Department Name */}
            <div className="sm:col-span-2">
              <label htmlFor="dept-name-input" className="block text-xs font-medium text-slate-700 mb-1">
                Department name <span className="text-rose-500">*</span>
              </label>
              <input
                id="dept-name-input"
                ref={mode === 'edit' ? firstInputRef : undefined}
                type="text"
                disabled={isSubmitting}
                placeholder="e.g. Cardiology"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                className={`w-full h-10 px-3 bg-white border rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors ${
                  errors.name
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300'
                }`}
                aria-describedby={errors.name ? 'dept-name-error' : undefined}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <p id="dept-name-error" className="text-[11px] text-rose-600 mt-1">
                  {errors.name}
                </p>
              )}
            </div>
          </div>

          {/* Display Label (Optional) */}
          <div>
            <label htmlFor="dept-display-name-input" className="block text-xs font-medium text-slate-700 mb-1">
              Display label <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="dept-display-name-input"
              type="text"
              disabled={isSubmitting}
              placeholder="e.g. Department of Clinical Cardiology"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors"
            />
          </div>

          {/* Head of Department (HOD) Selector */}
          <div>
            <label htmlFor="dept-hod-select" className="block text-xs font-medium text-slate-700 mb-1">
              Head of department (HOD) <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <select
              id="dept-hod-select"
              disabled={isSubmitting || isUsersLoading}
              value={hodId}
              onChange={(e) => setHodId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 transition-colors cursor-pointer"
            >
              <option value="">No HOD assigned (None)</option>
              {users.map((u) => {
                const userDept = u.department?.displayName || u.department?.name || '';
                const roleBadge = u.role ? u.role.replace(/_/g, ' ') : '';
                return (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({roleBadge}{userDept ? ` · ${userDept}` : ''})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Assigning a user as HOD configures them as the approval authority for this department.
            </p>
          </div>

          {/* Status Switch (when editing) */}
          {mode === 'edit' && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Department status
              </label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dept-status"
                    checked={isActive}
                    onChange={() => setIsActive(true)}
                    disabled={isSubmitting}
                    className="text-blue-700 focus:ring-blue-700"
                  />
                  <span className="text-xs font-medium text-slate-700">Active</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dept-status"
                    checked={!isActive}
                    onChange={() => setIsActive(false)}
                    disabled={isSubmitting}
                    className="text-blue-700 focus:ring-blue-700"
                  />
                  <span className="text-xs font-medium text-slate-700">Inactive</span>
                </label>
              </div>
            </div>
          )}

          {/* Actions */}
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
              ) : mode === 'create' ? (
                'Create department'
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

