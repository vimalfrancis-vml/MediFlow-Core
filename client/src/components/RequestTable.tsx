import { useNavigate } from 'react-router-dom';
import type { RequestItem } from '../services/api';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { formatDate } from '../utils/date';
import { useTerminology } from '../context/TerminologyContext';

interface RequestTableProps {
  requests: RequestItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  baseRoute?: string;
  page: number;
  hasMore: boolean;
  onPageChange: (newPage: number) => void;
}

export function RequestTable({ 
  requests, 
  isLoading, 
  error, 
  onRetry, 
  baseRoute = '/request',
  page,
  hasMore,
  onPageChange
}: RequestTableProps) {
  const navigate = useNavigate();
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();

  if (isLoading) {
    return (
      <div className="state-card loading-state bg-white p-6 rounded-xl shadow-xs border border-slate-200">
        <LoadingState message="Loading requests..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-card error-state bg-white p-8 rounded-xl shadow-xs border border-red-200 text-center">
        <p className="text-red-600 mb-4 text-sm">{error}</p>
        <button onClick={onRetry} className="btn-secondary text-xs">
          Retry
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="state-card empty-state bg-white p-8 rounded-xl shadow-xs border border-slate-200">
        <EmptyState
          message="No requests found matching your criteria."
          icon={
            <svg className="w-12 h-12 text-slate-300 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/90 border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reference</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Title</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(request => {
              const isHighCost = request.type === 'PURCHASE' && Number(request.purchaseDetail?.estimatedCost || 0) > 100000;
              return (
                <tr 
                  key={request.id} 
                  tabIndex={0}
                  role="button"
                  aria-label={`View request ${request.referenceNumber || ''}: ${request.title || ''}`}
                  onClick={() => navigate(`${baseRoute}/${request.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`${baseRoute}/${request.id}`);
                    }
                  }}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 focus-visible:outline-offset-[-2px] focus-visible:bg-indigo-50/30"
                >
                  <td className="px-4 sm:px-5 py-3 font-mono text-[11px] font-semibold text-slate-500">{request.referenceNumber || '—'}</td>
                  <td className="px-4 sm:px-5 py-3 font-medium text-slate-900">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{request.title || '—'}</span>
                      {isHighCost && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded" title="Mandatory Finance Review">
                          ₹ Policy
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 sm:px-5 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200/70 rounded text-xs font-medium text-slate-700 whitespace-nowrap">
                      {getRequestTypeLabel(request.type)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-5 py-3 text-slate-600 text-xs sm:text-sm">
                    {request.department?.displayName || request.department?.name || '—'}
                  </td>
                  <td className="px-4 sm:px-5 py-3 whitespace-nowrap text-slate-500 text-xs">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="px-4 sm:px-5 py-3">
                    <span className={`status-badge status-${(request.status || '').toLowerCase()}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">
          Page {page}
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => onPageChange(page - 1)} 
            disabled={page === 1}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
          >
            Previous
          </button>
          <button 
            onClick={() => onPageChange(page + 1)} 
            disabled={!hasMore}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
