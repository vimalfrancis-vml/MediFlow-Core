import { useState, type FC } from 'react';
import { api, type DepartmentPositionItem } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export interface DeactivatePositionModalProps {
  isOpen: boolean;
  position: DepartmentPositionItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeactivatePositionModal: FC<DeactivatePositionModalProps> = ({
  isOpen,
  position,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  if (!isOpen || !position) return null;

  const hasActiveAssignees = position.activeEmployeeCount > 0;
  const isBlocked = hasActiveAssignees && !(isAdmin && isOverride);

  const handleDeactivate = async () => {
    setError(null);

    if (isOverride && !overrideReason.trim()) {
      setError('Administrative override requires a justification reason.');
      return;
    }

    try {
      setIsLoading(true);
      await api.deactivateDepartmentPosition(position.id, {
        isOverride: isAdmin ? isOverride : undefined,
        overrideReason: isOverride ? overrideReason.trim() : undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate position.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deact-pos-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-rose-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-700 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <h2 id="deact-pos-title" className="text-base font-bold text-white">
                Deactivate Hospital Position
              </h2>
              <p className="text-xs text-rose-200">{position.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-rose-300 hover:text-white rounded-lg p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-slate-600">
            Are you sure you want to deactivate the hospital position{' '}
            <strong className="text-slate-900 font-semibold">{position.name}</strong>?
          </p>

          {/* Active Assignees Check */}
          {hasActiveAssignees ? (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Active Assignments Detected</span>
              </div>
              <p>
                <strong>{position.activeEmployeeCount} active employee(s)</strong> are currently assigned to this position ({position.activePrimaryCount} primary, {position.activeActingCount} acting).
              </p>
              <p className="text-rose-700">
                You must reassign these employees to other positions before deactivating this title.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
              No employees are currently assigned to this position. It can be safely deactivated and reactivated in the future if needed.
            </div>
          )}

          {/* Admin Override */}
          {isAdmin && hasActiveAssignees && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOverride}
                  onChange={(e) => setIsOverride(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-xs font-bold text-amber-950">
                  Administrative Override Deactivation
                </span>
              </label>
              {isOverride && (
                <div>
                  <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                    Override Justification Reason <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Department reorganization by Medical Director order"
                    className="w-full text-xs px-3 py-1.5 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          )}

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
              type="button"
              onClick={handleDeactivate}
              disabled={isBlocked || isLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deactivating...</span>
                </>
              ) : (
                'Deactivate Position'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

