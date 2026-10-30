import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, type RequestItem, type AnalyticsData } from '../services/api';
import { AnalyticsCards } from '../components/AnalyticsCards';
import { SimpleChart } from '../components/SimpleChart';
import { DataFilterBar } from '../components/DataFilterBar';
import { RequestTable } from '../components/RequestTable';
import { DashboardLayout } from '../components/DashboardLayout';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', status: '', type: '' });
  const [page, setPage] = useState(1);
  const limit = 10;

  async function fetchRequests() {
    if (!isAuthenticated || !user) return;
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
    if (isAuthenticated && user) {
      fetchRequests();
    }
  }, [filters, page, isAuthenticated, user]);

  if (isAuthLoading) {
    return <LoadingState message="Verifying session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout title="E-Office">
      {/* Page Heading & Action Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage, review, and track the status of your internal hospital requests.
          </p>
        </div>
        <button
          type="button"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#2457A7] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-sm font-semibold rounded-lg shadow-2xs transition-colors duration-150 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2457A7] focus-visible:outline-offset-2"
          onClick={() => navigate('/new-request')}
          id="new-request-button"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>New Request</span>
        </button>
      </div>

      {isLoading && !analytics && !requests.length ? (
        <div className="bg-white p-12 rounded-xl shadow-2xs border border-slate-200/90 text-center">
          <LoadingState message="Loading hospital dashboard data..." />
        </div>
      ) : error && !analytics && !requests.length ? (
        <div className="bg-white p-8 rounded-xl shadow-2xs border border-rose-200 text-center my-6">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900 mb-1">Failed to load overview data</p>
          <p className="text-xs text-rose-600 mb-4">{error}</p>
          <button 
            type="button"
            onClick={fetchRequests} 
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="mb-6">
            <AnalyticsCards data={analytics?.kpis || null} isLoading={isLoading && !analytics} />
          </div>

          {/* Main 2/3 + 1/3 Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left 2 Cols: Filter toolbar + Request Table */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <DataFilterBar onFilterChange={(f) => { setFilters(f); setPage(1); }} />
              {requests.length === 0 && !isLoading ? (
                <div className="bg-white p-8 rounded-xl shadow-2xs border border-slate-200/90">
                  <EmptyState
                    message="No requests match your current search or filter criteria."
                    actionLabel="Create New Request"
                    onAction={() => navigate('/new-request')}
                  />
                </div>
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

            {/* Right 1 Col: Status & Type Distribution Analytics */}
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
