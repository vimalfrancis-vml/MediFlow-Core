import { useNavigate, Link } from 'react-router-dom';
import type { RequestItem } from '../services/api';
import { LoadingState } from './LoadingState';
import { EmptyState } from './EmptyState';
import { StatusChip } from './StatusChip';
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
  const { getRequestTypeLabel } = useTerminology();

  if (isLoading) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-2xs border border-slate-200/90">
        <LoadingState message="Loading hospital requests..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-2xs border border-rose-200 text-center">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h4 className="text-sm font-semibold text-slate-900 mb-1">Failed to load request data</h4>
        <p className="text-rose-600 mb-4 text-xs max-w-md mx-auto">{error}</p>
        <button 
          onClick={onRetry} 
          className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-2xs border border-slate-200/90">
        <EmptyState
          message="No hospital requests match your filter criteria."
          icon={
            <svg className="w-10 h-10 text-slate-300 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-2xs border border-slate-200/90 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 border-collapse">
          <thead className="bg-[#F8FAFC] border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[145px] min-w-[135px]">
                Reference
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[240px]">
                Title
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[150px] min-w-[135px]">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[160px] min-w-[130px]">
                Department
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[115px] min-w-[105px]">
                Date
              </th>
              <th scope="col" className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-[140px] min-w-[125px]">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(request => {
              const isHighCost = request.type === 'PURCHASE' && Number(request.purchaseDetail?.estimatedCost || 0) > 100000;
              const targetUrl = `${baseRoute}/${request.id}`;

              return (
                <tr 
                  key={request.id} 
                  tabIndex={0}
                  role="link"
                  aria-label={`View request ${request.referenceNumber || ''}: ${request.title || ''}`}
                  onClick={() => navigate(targetUrl)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(targetUrl);
                    }
                  }}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7] focus-visible:outline-offset-[-2px] group"
                >
                  {/* Reference ID Column */}
                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100/80 border border-slate-200/90 px-2 py-0.5 rounded tracking-tight inline-block select-all">
                      {request.referenceNumber || '—'}
                    </span>
                  </td>

                  {/* Title Column */}
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex flex-col gap-1">
                      <Link 
                        to={targetUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-900 group-hover:text-[#2457A7] transition-colors leading-snug break-words focus-visible:outline-none focus-visible:underline"
                      >
                        {request.title || '—'}
                      </Link>
                      {isHighCost && (
                        <div>
                          <span 
                            className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded leading-none" 
                            title="Capital procurement exceeding ₹1,00,000 requires Step-1 Finance Review"
                          >
                            ₹ Finance Policy
                          </span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Request Type Column */}
                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 bg-slate-50 border border-slate-200/80 rounded text-xs font-medium text-slate-700">
                      {getRequestTypeLabel(request.type)}
                    </span>
                  </td>

                  {/* Department Column */}
                  <td className="px-4 py-3.5 align-top text-xs text-slate-600 leading-snug">
                    {request.department?.displayName || request.department?.name || '—'}
                  </td>

                  {/* Date Column */}
                  <td className="px-4 py-3.5 align-top whitespace-nowrap text-xs text-slate-500 tabular-nums">
                    {formatDate(request.createdAt)}
                  </td>

                  {/* Status Column */}
                  <td className="px-4 py-3.5 align-top whitespace-nowrap">
                    <StatusChip status={request.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-[#F8FAFC]/70 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-slate-500">
          Page {page} {requests.length > 0 && `(Showing ${requests.length} ${requests.length === 1 ? 'request' : 'requests'})`}
        </span>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => onPageChange(page - 1)} 
            disabled={page <= 1}
            aria-label="Previous Page"
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7]"
          >
            &larr; Previous
          </button>
          <button 
            type="button"
            onClick={() => onPageChange(page + 1)} 
            disabled={!hasMore}
            aria-label="Next Page"
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7]"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
