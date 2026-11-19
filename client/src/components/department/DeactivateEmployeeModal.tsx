import { useState, useEffect, useCallback, type FC } from 'react';
import { api, type DepartmentEmployeeItem, type DeactivationImpactResponse } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export interface DeactivateEmployeeModalProps {
  isOpen: boolean;
  employee: DepartmentEmployeeItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeactivateEmployeeModal: FC<DeactivateEmployeeModalProps> = ({
  isOpen,
  employee,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [impact, setImpact] = useState<DeactivationImpactResponse | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const checkImpact = useCallback(async () => {
    if (!employee) return;
    try {
      setIsLoadingImpact(true);
      setError(null);
      const res = await api.checkDeactivationImpact(employee.id);
      setImpact(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate deactivation impact.');
    } finally {
      setIsLoadingImpact(false);
    }
  }, [employee]);

  useEffect(() => {
    if (isOpen && employee) {
      checkImpact();
      setIsOverride(false);
      setOverrideReason('');
      setError(null);
    }
  }, [isOpen, employee, checkImpact]);

  if (!isOpen || !employee) return null;

  const handleDeactivate = async () => {
    setError(null);

    if (isOverride && !overrideReason.trim()) {
      setError('Administrative override requires a justification reason.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.deactivateDepartmentEmployee(employee.id, {
        isOverride: isAdmin ? isOverride : undefined,
        overrideReason: isOverride ? overrideReason.trim() : undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBlocked = impact ? !impact.canDeactivate && !(isAdmin && isOverride) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deact-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-rose-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-700 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 id="deact-modal-title" className="text-base font-bold text-white">
                Deactivate Department Employee
              </h2>
              <p className="text-xs text-rose-200">
                {employee.firstName} {employee.lastName} ({employee.employeeId})
              </p>
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

          {isLoadingImpact ? (
            <div className="py-8 text-center text-slate-500 space-y-2">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin mx-auto" />
              <p className="text-xs">Assessing workflow and position dependencies...</p>
            </div>
          ) : impact ? (
            <>
              {/* Warnings / Blocks */}
              {impact.warnings.length > 0 && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    !impact.canDeactivate
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>
                      {!impact.canDeactivate ? 'Deactivation Blocked by Safeguards' : 'Notice of Impact'}
                    </span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    {impact.warnings.map((w, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Impact Breakdown Cards */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-lg font-bold text-slate-800">
                    {impact.pendingAssignedCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Pending Approvals Assigned
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-lg font-bold text-slate-800">
                    {impact.openSubmittedCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Open Requests Submitted
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-lg font-bold text-slate-800">
                    {impact.activePositionsCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Positions to End
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
                <p>
                  <strong>What happens upon deactivation:</strong>
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>The employee account is soft-deactivated (historical records and requests preserved).</li>
                  <li>Active sessions are invalidated immediately.</li>
                  <li>All active hospital position placements are concluded.</li>
                </ul>
              </div>

              {/* Admin Override Option */}
              {isAdmin && !impact.canDeactivate && (
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
                        Override Justification Reason (Required for Audit Log) <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="e.g. Employee terminated abruptly; approvals re-assigned to Dr. Kumar"
                        className="w-full text-xs px-3 py-1.5 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={isBlocked || isSubmitting || isLoadingImpact}
              className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deactivating...</span>
                </>
              ) : (
                'Confirm Deactivation'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
