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

export default function AdminDashboardPage() {
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
      setError(err.message || 'Failed to load requests.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, [filters, page]);

  return (
    <DashboardLayout 
      title="MediFlow" 
      brandPrefix="Admin"
      nav={
        <nav className="admin-nav flex items-center gap-2 sm:gap-4 mr-2 sm:mr-4">
          <button className="nav-link-btn text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/admin')}>Overview</button>
          <button className="nav-link-btn text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/admin/users')}>Users</button>
          <button className="nav-link-btn text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => navigate('/admin/departments')}>Departments</button>
        </nav>
      }
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-1">System-wide overview of all workflows and requests.</p>
        </div>
      </div>

      {isLoading && !analytics && !requests.length ? (
        <LoadingState message="Loading dashboard data..." />
      ) : error && !analytics && !requests.length ? (
        <div className="text-center p-8">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={fetchRequests} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg">Retry</button>
        </div>
      ) : (
        <>
          <AnalyticsCards data={analytics?.kpis || null} isLoading={isLoading && !analytics} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <DataFilterBar onFilterChange={(f) => { setFilters(f); setPage(1); }} />
              {requests.length === 0 && !isLoading ? (
                <EmptyState message="No requests found matching your criteria." />
              ) : (
                <RequestTable 
                  requests={requests}
                  isLoading={isLoading}
                  error={error}
                  onRetry={fetchRequests}
                  baseRoute="/request"
                  page={page}
                  hasMore={requests.length === limit}
                  onPageChange={setPage}
                />
              )}
            </div>
            <div className="flex flex-col gap-6">
              <SimpleChart title="Requests by Status" data={analytics?.distribution.status || []} />
              <SimpleChart title="Requests by Type" data={analytics?.distribution.type || []} />
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

