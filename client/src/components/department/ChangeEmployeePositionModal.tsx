import { useState, useEffect, type FC, type FormEvent } from 'react';
import { api, type DepartmentPositionItem, type DepartmentEmployeeItem } from '../../services/api';

export interface ChangeEmployeePositionModalProps {
  isOpen: boolean;
  employee: DepartmentEmployeeItem | null;
  positions: DepartmentPositionItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export const ChangeEmployeePositionModal: FC<ChangeEmployeePositionModalProps> = ({
  isOpen,
  employee,
  positions,
  onClose,
  onSuccess,
}) => {
  const [positionId, setPositionId] = useState('');
  const [assignmentType, setAssignmentType] = useState<'PRIMARY' | 'ACTING' | 'ADDITIONAL'>('PRIMARY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPositionId('');
      setAssignmentType('PRIMARY');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setReason('');
      setError(null);
    }
  }, [isOpen, employee]);

  if (!isOpen || !employee) return null;

  const activePositions = positions.filter((p) => p.isActive);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!positionId) {
      setError('Please select a hospital position.');
      return;
    }

    if (assignmentType === 'ACTING' && !endDate) {
      setError('Acting position assignments require an end date.');
      return;
    }

    if (endDate && new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after the start date.');
      return;
    }

    try {
      setIsLoading(true);
      await api.assignEmployeePosition(employee.id, {
        positionId,
        assignmentType,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update hospital position.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pos-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 id="change-pos-modal-title" className="text-base font-bold text-white">
                Assign / Change Position
              </h2>
              <p className="text-xs text-slate-300">
                {employee.firstName} {employee.lastName} ({employee.employeeId})
              </p>
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

          {/* Current Position Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Current Primary Position:</span>
            <span className="text-xs font-bold text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200">
              {employee.primaryPosition ? employee.primaryPosition.name : 'None (Unassigned)'}
            </span>
          </div>

          {/* Position Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Hospital Position <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
            >
              <option value="">-- Select Hospital Position --</option>
              {activePositions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignment Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assignment Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentType('PRIMARY')}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  assignmentType === 'PRIMARY'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Primary
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('ACTING')}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  assignmentType === 'ACTING'
                    ? 'border-amber-600 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Acting (Temporary)
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('ADDITIONAL')}
                className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                  assignmentType === 'ADDITIONAL'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Additional
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {assignmentType === 'PRIMARY' && 'Setting a new Primary position gracefully ends their previous Primary placement.'}
              {assignmentType === 'ACTING' && 'Acting positions are temporary duty assignments and require an end date.'}
              {assignmentType === 'ADDITIONAL' && 'Additional positions run concurrently without altering the primary position.'}
            </p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Effective Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date {assignmentType === 'ACTING' && <span className="text-rose-500">* (Required)</span>}
              </label>
              <input
                type="date"
                required={assignmentType === 'ACTING'}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Reason / Justification */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason / Justification (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual rotation, Ward shift, Covering maternity leave"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Architectural Protection Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <strong className="font-semibold text-amber-950">Architectural Rule:</strong> Changing this hospital job title does <strong className="text-amber-950">not</strong> alter the employee's E-Office system role, permissions, or workflow approval authority. Approval authority remains tied strictly to system roles.
            </div>
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
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Assigning Position...</span>
                </>
              ) : (
                'Save Position Assignment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

