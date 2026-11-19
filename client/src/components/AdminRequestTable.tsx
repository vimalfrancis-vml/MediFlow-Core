import { useState, useMemo, type MouseEvent, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RequestItem } from '../services/api';
import { StatusChip } from './StatusChip';
import { fmtDate } from '../utils/date';
import { useTerminology } from '../context/TerminologyContext';

export interface AdminRequestTableProps {
  requests: RequestItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  baseRoute?: string;
  page: number;
  pageSize: number;
  totalCount?: number;
  hasMore: boolean;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

type SortField = 'date' | 'amount';
type SortDirection = 'asc' | 'desc';

export const AdminRequestTable: FC<AdminRequestTableProps> = ({
  requests,
  isLoading,
  error,
  onRetry,
  baseRoute = '/request',
  page,
  pageSize,
  totalCount,
  hasMore,
  onPageChange,
  onPageSizeChange,
  hasActiveFilters = false,
  onClearFilters,
}) => {
  const navigate = useNavigate();
  const { getRequestTypeLabel } = useTerminology();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleCopyReference = (e: MouseEvent, refNumber: string, id: string) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(refNumber);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort loaded records if sortField is selected
  const sortedRequests = useMemo(() => {
    if (!sortField) return requests;
    return [...requests].sort((a, b) => {
      if (sortField === 'date') {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'amount') {
        const amountA = Number(a.purchaseDetail?.estimatedCost) || 0;
        const amountB = Number(b.purchaseDetail?.estimatedCost) || 0;
        return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
      }
      return 0;
    });
  }, [requests, sortField, sortDirection]);

  // Pagination bounds calculation
  const effectiveTotal = typeof totalCount === 'number' ? totalCount : requests.length;
  const startItem = requests.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(startItem + requests.length - 1, effectiveTotal || startItem + requests.length - 1);
  const totalPages = effectiveTotal > 0 ? Math.ceil(effectiveTotal / pageSize) : 1;
  const isNextDisabled = totalCount !== undefined ? page >= totalPages : !hasMore;

  // Loading Skeleton State
  if (isLoading && requests.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full table-fixed text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="h-10 text-xs font-semibold text-slate-600">
                <th className="w-48 px-4 py-2.5">Reference</th>
                <th className="w-64 px-4 py-2.5">Title</th>
                <th className="w-40 px-4 py-2.5">Requester</th>
                <th className="w-40 px-4 py-2.5">Type</th>
                <th className="w-44 px-4 py-2.5">Department</th>
                <th className="w-32 px-4 py-2.5 text-right">Amount</th>
                <th className="w-44 px-4 py-2.5">With</th>
                <th className="w-32 px-4 py-2.5">Date</th>
                <th className="w-36 px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <tr key={i} className="h-12 animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-44" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                  <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                  <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                  <td className="px-4 py-3"><div className="h-5 bg-slate-200 rounded-full w-24" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Error State
  if (error && requests.length === 0) {
    return (
      <div className="rounded-lg border border-rose-200 bg-white p-8 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">Unable to load requests.</p>
        <p className="text-xs text-rose-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="h-10 px-4 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty State
  if (requests.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-2xs">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">No requests match the filters.</p>
        <p className="text-xs text-slate-500 mb-4">Try adjusting or clearing your search criteria.</p>
        {hasActiveFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="h-9 px-3.5 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-xs font-medium transition-colors shadow-2xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col">
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full table-fixed text-left text-sm border-collapse">
          {/* Table Header */}
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="h-10 text-xs font-semibold text-slate-600">
              <th scope="col" className="w-48 px-4 py-2.5">Reference</th>
              <th scope="col" className="w-64 px-4 py-2.5">Title</th>
              <th scope="col" className="w-40 px-4 py-2.5">Requester</th>
              <th scope="col" className="w-40 px-4 py-2.5">Type</th>
              <th scope="col" className="w-44 px-4 py-2.5">Department</th>

              {/* Sortable Amount Header */}
              <th
                scope="col"
                className="w-32 px-4 py-2.5 text-right cursor-pointer select-none hover:text-slate-900 transition-colors"
                aria-sort={
                  sortField === 'amount'
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                onClick={() => handleSort('amount')}
              >
                <div className="inline-flex items-center justify-end gap-1.5 w-full">
                  <span>Amount</span>
                  <span className="text-slate-400 text-[10px]" aria-hidden="true">
                    {sortField === 'amount' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>

              <th scope="col" className="w-44 px-4 py-2.5">With</th>

              {/* Sortable Date Header */}
              <th
                scope="col"
                className="w-32 px-4 py-2.5 cursor-pointer select-none hover:text-slate-900 transition-colors"
                aria-sort={
                  sortField === 'date'
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                onClick={() => handleSort('date')}
              >
                <div className="inline-flex items-center gap-1.5">
                  <span>Date</span>
                  <span className="text-slate-400 text-[10px]" aria-hidden="true">
                    {sortField === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                  </span>
                </div>
              </th>

              <th scope="col" className="w-36 px-4 py-2.5">Status</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {sortedRequests.map((request) => {
              const targetUrl = `${baseRoute}/${request.id}`;
              const isHighCost =
                request.type === 'PURCHASE' &&
                Number(request.purchaseDetail?.estimatedCost || 0) > 100000;

              const requesterName = request.requestedBy
                ? `${request.requestedBy.firstName} ${request.requestedBy.lastName}`.trim()
                : '—';

              const deptName =
                request.department?.displayName ||
                request.department?.name ||
                '—';

              const amountValue =
                request.type === 'PURCHASE' && request.purchaseDetail?.estimatedCost != null
                  ? `₹${Number(request.purchaseDetail.estimatedCost).toLocaleString('en-IN')}`
                  : '—';

              let withAssignee = '—';
              if (request.status === 'APPROVED' || request.status === 'REJECTED' || request.status === 'CANCELLED') {
                withAssignee = '—';
              } else if (request.assignedToUser) {
                withAssignee = `${request.assignedToUser.firstName} ${request.assignedToUser.lastName}`.trim();
              } else if (request.currentStep?.stepName) {
                withAssignee = request.currentStep.stepName;
              } else if (request.currentStep?.approverRole) {
                withAssignee = request.currentStep.approverRole.replace(/_/g, ' ');
              }

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
                  className="h-12 hover:bg-slate-50 cursor-pointer transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-[-2px] group"
                >
                  {/* Reference Column */}
                  <td className="px-4 py-2 align-middle">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-xs font-medium text-slate-700 truncate max-w-[120px] inline-block"
                        title={request.referenceNumber || ''}
                      >
                        {request.referenceNumber || '—'}
                      </span>
                      {request.referenceNumber && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyReference(e, request.referenceNumber, request.id)}
                          aria-label={`Copy reference ID ${request.referenceNumber}`}
                          title={copiedId === request.id ? 'Copied!' : 'Copy reference ID'}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-blue-700"
                        >
                          {copiedId === request.id ? (
                            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Title Column */}
                  <td className="px-4 py-2 align-middle">
                    <span
                      className="text-sm font-medium text-slate-900 group-hover:text-blue-700 line-clamp-2 leading-snug"
                      title={request.title}
                    >
                      {request.title || '—'}
                    </span>
                  </td>

                  {/* Requester Column */}
                  <td className="px-4 py-2 align-middle">
                    <span
                      className="text-sm text-slate-700 truncate block"
                      title={requesterName}
                    >
                      {requesterName}
                    </span>
                  </td>

                  {/* Type Column */}
                  <td className="px-4 py-2 align-middle">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-slate-700">
                        {getRequestTypeLabel(request.type)}
                      </span>
                      {isHighCost && (
                        <span
                          className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap"
                          title="Capital procurement exceeding ₹1,00,000 requires Step-1 Finance Review"
                        >
                          · Finance policy
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Department Column */}
                  <td className="px-4 py-2 align-middle">
                    <span
                      className="text-sm text-slate-600 truncate block"
                      title={deptName}
                    >
                      {deptName}
                    </span>
                  </td>

                  {/* Amount Column */}
                  <td className="px-4 py-2 align-middle text-right">
                    <span className="text-sm tabular-nums text-slate-900 font-medium">
                      {amountValue}
                    </span>
                  </td>

                  {/* With Column */}
                  <td className="px-4 py-2 align-middle">
                    <span
                      className="text-sm text-slate-600 truncate block"
                      title={withAssignee}
                    >
                      {withAssignee}
                    </span>
                  </td>

                  {/* Date Column */}
                  <td className="px-4 py-2 align-middle whitespace-nowrap">
                    <span className="text-sm tabular-nums text-slate-600">
                      {fmtDate(request.createdAt)}
                    </span>
                  </td>

                  {/* Status Column */}
                  <td className="px-4 py-2 align-middle whitespace-nowrap">
                    <StatusChip status={request.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="font-semibold text-slate-900">{startItem}–{endItem}</strong> of{' '}
            <strong className="font-semibold text-slate-900">{effectiveTotal}</strong>
          </span>

          {onPageSizeChange && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="admin-page-size-select" className="text-slate-500">
                Per page:
              </label>
              <select
                id="admin-page-size-select"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Previous
          </button>
          <span className="text-slate-500 px-1">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={isNextDisabled}
            aria-label="Next page"
            className="h-8 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 hover:border-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
