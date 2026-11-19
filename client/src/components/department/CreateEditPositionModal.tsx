import { useState, useEffect, type FC, type FormEvent } from 'react';
import { api, type DepartmentPositionItem } from '../../services/api';

export interface CreateEditPositionModalProps {
  isOpen: boolean;
  position: DepartmentPositionItem | null; // null for create mode
  departmentName?: string;
  departmentId?: string;
  onClose: () => void;
  onSuccess: (warning?: string | null) => void;
}

export const CreateEditPositionModal: FC<CreateEditPositionModalProps> = ({
  isOpen,
  position,
  departmentName,
  departmentId,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(position);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (position) {
        setName(position.name);
        setDescription(position.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, position]);

  if (!isOpen) return null;

  // Sensitive keywords notice check
  const sensitiveKeywords = ['admin', 'hod', 'director', 'approver', 'finance officer', 'procurement officer'];
  const hasKeywordWarning = sensitiveKeywords.some((k) => name.toLowerCase().includes(k));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      setError('Position title must be between 2 and 100 characters.');
      return;
    }

    try {
      setIsLoading(true);
      if (isEditing && position) {
        await api.updateDepartmentPosition(position.id, {
          name: cleanName,
          description: description.trim() || undefined,
          version: position.version,
        });
        onSuccess(null);
      } else {
        const res = await api.createDepartmentPosition({
          name: cleanName,
          description: description.trim() || undefined,
          departmentId,
        });
        onSuccess(res.warning);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save position.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-modal-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 id="pos-modal-title" className="text-base font-bold text-white">
                {isEditing ? 'Edit Hospital Position' : 'Create Hospital Position'}
              </h2>
              {departmentName && (
                <p className="text-xs text-slate-300">Department: {departmentName}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Position Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior Staff Nurse, Clinical Resident, Ward Supervisor"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Must be unique within the department (case-insensitive).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional overview of duties or functional scope..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Keyword Warning if title contains system role terms */}
          {hasKeywordWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <strong className="font-semibold text-amber-950">System Role Warning:</strong> This title contains words that resemble an E-Office system role. Remember that hospital positions are organizational job titles and do <strong className="text-amber-950">not</strong> grant system permissions or workflow authority.
              </div>
            </div>
          )}

          {/* Info Notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600">
            Hospital positions are departmental organizational titles. They can be assigned to multiple employees and reassigned at any time.
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Position'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

