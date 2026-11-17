import { useState, useEffect, useCallback, type FC } from 'react';
import { api, type EmployeePositionHistoryItem, type DepartmentEmployeeItem } from '../../services/api';

export interface EmployeePositionHistoryModalProps {
  isOpen: boolean;
  employee: DepartmentEmployeeItem | null;
  onClose: () => void;
}

export const EmployeePositionHistoryModal: FC<EmployeePositionHistoryModalProps> = ({
  isOpen,
  employee,
  onClose,
}) => {
  const [history, setHistory] = useState<EmployeePositionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!employee) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.getEmployeePositionHistory(employee.id);
      setHistory(res.data.history || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load position history.');
    } finally {
      setIsLoading(false);
    }
  }, [employee]);

  useEffect(() => {
    if (isOpen && employee) {
      loadHistory();
    }
  }, [isOpen, employee, loadHistory]);

  if (!isOpen || !employee) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Present';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'PRIMARY':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ACTING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ADDITIONAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-hist-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 id="pos-hist-title" className="text-base font-bold text-white">
                Position & Role History
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

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500">
              <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-xs font-medium">Loading position history...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
              {error}
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-semibold">No position history recorded</p>
              <p className="text-xs text-slate-400 mt-1">This employee has not yet been assigned a hospital position.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Chronological audit record of hospital job titles held by this employee within the department.
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Position Title (At Time)</th>
                      <th className="py-2.5 px-3">Assignment Type</th>
                      <th className="py-2.5 px-3">Tenure / Period</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Reason / Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {item.positionName}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getBadgeClass(
                              item.assignmentType
                            )}`}
                          >
                            {item.assignmentType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {formatDate(item.startDate)} - {formatDate(item.endDate)}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                              Ended
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 italic">
                          {item.reason || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
