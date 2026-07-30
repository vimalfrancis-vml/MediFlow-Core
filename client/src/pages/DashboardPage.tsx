import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type RequestItem } from '../services/api';
import { AnalyticsCards } from '../components/AnalyticsCards';
import { SimpleChart } from '../components/SimpleChart';
import { DataFilterBar } from '../components/DataFilterBar';
import { RequestTable } from '../components/RequestTable';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import type { AnalyticsData } from '../services/api';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
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
      setRequests(reqRes.data || []);
      setAnalytics(analyticsRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, [filters, page]);

  return (
    <DashboardLayout title="MediFlow">
      {/* Page heading row */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and track the status of your internal requests.</p>
        </div>
        <button
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors duration-150"
          onClick={() => navigate('/new-request')}
        >
          + New Request
        </button>
      </div>

      {isLoading && !analytics && !requests.length ? (
        <LoadingState message="Loading dashboard data..." />
      ) : error && !analytics && !requests.length ? (
        <div className="text-center py-12">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button onClick={fetchRequests} className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-md hover:bg-indigo-100 transition-colors">Retry</button>
        </div>
      ) : (
        <>
          {/* KPI cards — mb-6 below to match heading rhythm */}
          <div className="mb-6">
            <AnalyticsCards data={analytics?.kpis || null} isLoading={isLoading && !analytics} />
          </div>

          {/* Main content grid — gap-6 consistent with card padding */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: filter + table */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <DataFilterBar onFilterChange={(f) => { setFilters(f); setPage(1); }} />
              {requests.length === 0 && !isLoading ? (
                <EmptyState
                  message="No requests found matching your criteria."
                  actionLabel="Create New Request"
                  onAction={() => navigate('/new-request')}
                />
              ) : (
                <RequestTable
                  requests={requests}
                  isLoading={isLoading}
                  error={error}
                  onRetry={fetchRequests}
                  page={page}
                  hasMore={requests.length === limit}
                  onPageChange={setPage}
                />
              )}
            </div>
            {/* Right: charts — gap-4 matching left column gap */}
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

