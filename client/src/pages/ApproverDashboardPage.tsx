import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type RequestItem } from '../services/api';
import { AnalyticsCards } from '../components/AnalyticsCards';
import { SimpleChart } from '../components/SimpleChart';
import { DataFilterBar } from '../components/DataFilterBar';
import { RequestTable } from '../components/RequestTable';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import type { AnalyticsData } from '../services/api';
import './DashboardPage.css';

export default function ApproverDashboardPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [page, setPage] = useState(1);
  const limit = 10;

  async function fetchRequests() {
    try {
      setIsLoading(true);
      const [reqRes, analyticsRes] = await Promise.all([
        api.getRequests({ ...filters, page, limit }),
        api.getAnalytics()
      ]);
      let fetchedRequests = reqRes.data || [];
      if (viewMode === 'pending') {
        fetchedRequests = fetchedRequests.filter((r) => r.status === 'IN_REVIEW');
      } else if (viewMode === 'history') {
        fetchedRequests = fetchedRequests.filter(
          (r) => r.status === 'APPROVED' || r.status === 'REJECTED' || r.status === 'RETURNED'
        );
      }
      setRequests(fetchedRequests);
      setAnalytics(analyticsRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load requests.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, [filters, page, viewMode]);

  return (
    <DashboardLayout title="MediFlow" brandPrefix="Approver">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Approver Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review, verify, and act on workflow requests awaiting authorization.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Segmented Tab Control */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200/80 w-full sm:w-auto" role="tablist" aria-label="Approver view mode">
            <button
              role="tab"
              aria-selected={viewMode === 'pending'}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'pending'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => { setViewMode('pending'); setPage(1); }}
            >
              Pending Approval
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'history'}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'history'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => { setViewMode('history'); setPage(1); }}
            >
              Completed History
            </button>
          </div>

          <button
            className="btn-primary whitespace-nowrap text-xs sm:text-sm py-2"
            onClick={() => navigate('/new-request')}
          >
            + New Request
          </button>
        </div>
      </div>

      {isLoading && !analytics && !requests.length ? (
        <LoadingState message="Loading approver dashboard..." />
      ) : error && !analytics && !requests.length ? (
        <div className="text-center p-8 bg-white rounded-xl border border-red-200">
          <p className="text-red-600 mb-4 text-sm">{error}</p>
          <button onClick={fetchRequests} className="btn-secondary text-xs">Retry</button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <AnalyticsCards data={analytics?.kpis || null} isLoading={isLoading && !analytics} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <DataFilterBar onFilterChange={(f) => { setFilters(f); setPage(1); }} />
              <RequestTable 
                requests={requests}
                isLoading={isLoading}
                error={error}
                onRetry={fetchRequests}
                baseRoute="/approver/request"
                page={page}
                hasMore={requests.length === limit}
                onPageChange={setPage}
              />
            </div>
            <div className="flex flex-col gap-4">
              <SimpleChart title="Requests by Status" data={analytics?.distribution.status || []} />
              <SimpleChart title="Requests by Type" data={analytics?.distribution.type || []} />
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

