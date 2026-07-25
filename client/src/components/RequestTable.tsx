import { useNavigate } from 'react-router-dom';
import type { RequestItem } from '../services/api';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';

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

  if (isLoading) {
    return (
      <div className="state-card loading-state bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <LoadingState message="Loading requests..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-card error-state bg-white p-10 rounded-xl shadow-sm border border-slate-100 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={onRetry} className="retry-btn bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100 font-medium transition-colors">
          Retry
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="state-card empty-state bg-white p-6 rounded-xl shadow-sm border border-slate-100">
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3">Reference</th>
              <th scope="col" className="px-4 py-3">Title</th>
              <th scope="col" className="px-4 py-3">Type</th>
              <th scope="col" className="px-4 py-3">Department</th>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(request => (
              <tr 
                key={request.id} 
                onClick={() => navigate(`${baseRoute}/${request.id}`)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium text-slate-900">{request.referenceNumber || '—'}</td>
                <td className="px-4 py-3">{request.title || '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">
                    {request.type || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">{request.department?.name || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`request-status status-${(request.status || '').toLowerCase()} px-2 py-1 rounded text-xs font-medium`}>
                    {request.status || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Page {page}
        </span>
        <div className="flex gap-2">
          <button 
            onClick={() => onPageChange(page - 1)} 
            disabled={page === 1}
            className="px-3 py-1 bg-white border border-slate-200 rounded text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            Previous
          </button>
          <button 
            onClick={() => onPageChange(page + 1)} 
            disabled={!hasMore}
            className="px-3 py-1 bg-white border border-slate-200 rounded text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
