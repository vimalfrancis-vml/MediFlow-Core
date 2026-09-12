import React, { useState, useEffect } from 'react';
import { api, type AuditLogListItem } from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { AdminNav } from '../components/AdminNav';
import { formatDateTime } from '../utils/date';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAuditLogs({
        search: search.trim() || undefined,
        action: actionFilter || undefined,
        page,
        limit: 20,
      });
      setLogs(res.data.items || []);
      setPagination(res.data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <DashboardLayout
      title="MediFlow"
      brandPrefix="Admin"
      nav={<AdminNav />}
    >
      <div className="audit-logs-page max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">System Audit Logs</h1>
            <p className="text-slate-500 mt-1">
              Immutable record of all workflow events, administrative updates, forwarding actions, and status changes.
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <form onSubmit={handleSearchSubmit} className="bg-white p-4 rounded-xl shadow-xs border border-slate-200/80 mb-6 flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search Audit Trail</label>
            <input
              type="text"
              placeholder="Search by action, description, reference #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Filter by Action</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 bg-white"
            >
              <option value="">All Actions</option>
              <option value="CREATED">CREATED</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="FORWARDED">FORWARDED</option>
              <option value="RETURNED">RETURNED</option>
              <option value="USER_UPDATED">USER_UPDATED</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-semibold rounded-md border border-red-200">
            ✕ {error}
          </div>
        )}

        {isLoading ? (
          <LoadingState message="Loading audit records..." />
        ) : logs.length === 0 ? (
          <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
            No audit records found matching your filters.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Target Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        log.action === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                        log.action === 'FORWARDED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        log.action === 'USER_UPDATED' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-700 max-w-sm">
                      {log.description}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {log.actor ? (
                        <div>
                          <p className="font-semibold text-slate-800">
                            {log.actor.firstName} {log.actor.lastName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {log.actor.roleRef?.displayName || log.actor.role.replace(/_/g, ' ')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {log.request ? (
                        <div>
                          <p className="font-mono font-bold text-indigo-700">{log.request.referenceNumber}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{log.request.title}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">System Admin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {logs.length} of {pagination.total} audit logs (Page {page} of {pagination.totalPages})
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
