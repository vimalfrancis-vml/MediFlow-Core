import { useState, useEffect, useCallback, useMemo } from 'react';
import { api, type RequestItem, type AnalyticsData, type DepartmentItem } from '../services/api';
import { AppShell } from '../components/AppShell';
import { AdminNav } from '../components/AdminNav';
import { KpiCard } from '../components/KpiCard';
import { Bars, type BarItem } from '../components/Bars';
import { AdminFilterToolbar } from '../components/AdminFilterToolbar';
import { AdminRequestTable } from '../components/AdminRequestTable';
import { STATUS } from '../constants/status';
import { useTerminology } from '../context/TerminologyContext';

export default function AdminDashboardPage() {
  const { getStatusLabel, getRequestTypeLabel } = useTerminology();

  // Data states
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch departments directory once on mount
  useEffect(() => {
    let isMounted = true;
    api.getDepartments()
      .then((res) => {
        if (isMounted && res?.data) {
          setDepartments(res.data);
        }
      })
      .catch(() => {
        // Silently tolerate if department list fails
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch requests & analytics from API
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [reqRes, analyticsRes] = await Promise.all([
        api.getRequests({
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          page,
          limit: pageSize,
        }),
        api.getAnalytics(),
      ]);

      setRequests(reqRes.data || []);
      setAnalytics(analyticsRes.data || null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load requests.');
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, statusFilter, typeFilter, page, pageSize]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Clear all filters handler
  const handleClearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setDepartmentFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    search ||
    statusFilter ||
    typeFilter ||
    departmentFilter ||
    startDateFilter ||
    endDateFilter
  );

  // KPI Calculations from real server analytics data
  const kpiCounts = useMemo(() => {
    const total = analytics?.kpis?.total || 0;
    const statusMap = new Map<string, number>();

    if (analytics?.distribution?.status) {
      for (const item of analytics.distribution.status) {
        statusMap.set(item.name.toUpperCase(), item.value);
      }
    }

    const underReview = statusMap.get('IN_REVIEW') ?? (analytics?.kpis?.pending || 0);
    const approved = statusMap.get('APPROVED') ?? (analytics?.kpis?.approved || 0);
    const rejected = statusMap.get('REJECTED') ?? (analytics?.kpis?.rejected || 0);
    const returned = statusMap.get('RETURNED') ?? (analytics?.kpis?.returned || 0);
    const draft = statusMap.get('DRAFT') || 0;
    const cancelled = statusMap.get('CANCELLED') || 0;

    return {
      total,
      underReview,
      approved,
      rejected,
      returned,
      draft,
      cancelled,
    };
  }, [analytics]);

  // Filter requests locally ONLY if client-only filter fields (department, dates) are chosen
  // (Preserves server pagination when these secondary filters are empty)
  const displayedRequests = useMemo(() => {
    if (!departmentFilter && !startDateFilter && !endDateFilter) {
      return requests;
    }

    return requests.filter((req) => {
      // Department filter
      if (departmentFilter) {
        const reqDeptId = (req as any).departmentId || (req.department as any)?.id;
        const matchesDept = reqDeptId === departmentFilter || req.department?.name === departmentFilter;
        if (!matchesDept) return false;
      }

      // Date range filter
      if (startDateFilter) {
        const reqDate = new Date(req.createdAt).getTime();
        const start = new Date(startDateFilter).getTime();
        if (reqDate < start) return false;
      }
      if (endDateFilter) {
        const reqDate = new Date(req.createdAt).getTime();
        const end = new Date(endDateFilter).getTime() + 86400000; // end of selected day
        if (reqDate > end) return false;
      }

      return true;
    });
  }, [requests, departmentFilter, startDateFilter, endDateFilter]);

  // Overdue requests metric calculation: pending requests in review for > 3 days
  const overdueCount = useMemo(() => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return requests.filter((r) => {
      if (r.status !== 'IN_REVIEW') return false;
      const refTime = r.submittedAt
        ? new Date(r.submittedAt).getTime()
        : new Date(r.createdAt).getTime();
      return now - refTime > threeDaysMs;
    }).length;
  }, [requests]);

  // Analytics Card 1: Requests by status items
  const statusBarsData: BarItem[] = useMemo(() => {
    const total = kpiCounts.total;
    const items: { label: string; count: number; barColor: string }[] = [
      {
        label: 'Under review',
        count: kpiCounts.underReview,
        barColor: STATUS.IN_REVIEW.barColor,
      },
      {
        label: 'Approved',
        count: kpiCounts.approved,
        barColor: STATUS.APPROVED.barColor,
      },
      {
        label: 'Rejected',
        count: kpiCounts.rejected,
        barColor: STATUS.REJECTED.barColor,
      },
      {
        label: 'Returned',
        count: kpiCounts.returned,
        barColor: STATUS.RETURNED.barColor,
      },
      {
        label: 'Draft',
        count: kpiCounts.draft,
        barColor: STATUS.DRAFT.barColor,
      },
      {
        label: 'Cancelled',
        count: kpiCounts.cancelled,
        barColor: STATUS.CANCELLED.barColor,
      },
    ];

    return items.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }, [kpiCounts]);

  // Analytics Card 2: Requests by type items
  const typeBarsData: BarItem[] = useMemo(() => {
    const total = kpiCounts.total;
    const rawTypes = analytics?.distribution?.type || [];

    // Ensure standard request types are represented
    const standardTypes = ['PURCHASE', 'MAINTENANCE', 'LEAVE', 'GENERAL'];
    const typeCountMap = new Map<string, number>();

    for (const t of rawTypes) {
      typeCountMap.set(t.name.toUpperCase(), t.value);
    }

    return standardTypes.map((typeKey) => {
      const count = typeCountMap.get(typeKey) || 0;
      return {
        label: getRequestTypeLabel(typeKey),
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        barColor: 'bg-blue-700',
      };
    });
  }, [analytics, kpiCounts.total, getRequestTypeLabel]);

  // Total count for current status filter
  const currentStatusTotal = useMemo(() => {
    if (!statusFilter) return kpiCounts.total;
    switch (statusFilter) {
      case 'IN_REVIEW':
        return kpiCounts.underReview;
      case 'APPROVED':
        return kpiCounts.approved;
      case 'REJECTED':
        return kpiCounts.rejected;
      case 'RETURNED':
        return kpiCounts.returned;
      case 'DRAFT':
        return kpiCounts.draft;
      case 'CANCELLED':
        return kpiCounts.cancelled;
      default:
        return kpiCounts.total;
    }
  }, [statusFilter, kpiCounts]);

  // KPI card selection handler
  const handleKpiClick = (targetStatus: string) => {
    if (!targetStatus) {
      // Total requests clicked: clear status filter
      setStatusFilter('');
    } else if (statusFilter === targetStatus) {
      // Toggle off if already selected
      setStatusFilter('');
    } else {
      setStatusFilter(targetStatus);
    }
    setPage(1);
  };

  return (
    <AppShell role="ADMIN" nav={<AdminNav />}>
      {/* Admin Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Admin dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            System-wide overview of workflows and requests
          </p>
        </div>

        {/* Optional Overdue Request Metric Card (Restrained Amber Accent) */}
        <div
          className="rounded-lg border border-amber-200/90 bg-amber-50/70 px-3.5 py-2 flex items-center gap-2.5 text-xs text-amber-900 shadow-2xs self-stretch sm:self-auto"
          title="Number of requests currently in review for more than 3 days"
        >
          <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" aria-hidden="true" />
          <span className="font-medium">
            Waiting &gt; 3 days:
          </span>
          <span className="font-semibold tabular-nums text-sm text-amber-950">
            {overdueCount}
          </span>
        </div>
      </div>

      {/* KPI Cards Grid (7 Categories) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        <KpiCard
          label="Total requests"
          count={kpiCounts.total}
          accentBorder="border-l-blue-700"
          isSelected={statusFilter === ''}
          onClick={() => handleKpiClick('')}
          ariaLabel={`Total requests: ${kpiCounts.total}. Click to clear status filter.`}
        />
        <KpiCard
          label={getStatusLabel('IN_REVIEW')}
          count={kpiCounts.underReview}
          accentBorder={STATUS.IN_REVIEW.accentBorder}
          isSelected={statusFilter === 'IN_REVIEW'}
          onClick={() => handleKpiClick('IN_REVIEW')}
          ariaLabel={`${getStatusLabel('IN_REVIEW')}: ${kpiCounts.underReview}. Click to filter.`}
        />
        <KpiCard
          label={getStatusLabel('APPROVED')}
          count={kpiCounts.approved}
          accentBorder={STATUS.APPROVED.accentBorder}
          isSelected={statusFilter === 'APPROVED'}
          onClick={() => handleKpiClick('APPROVED')}
          ariaLabel={`${getStatusLabel('APPROVED')}: ${kpiCounts.approved}. Click to filter.`}
        />
        <KpiCard
          label={getStatusLabel('REJECTED')}
          count={kpiCounts.rejected}
          accentBorder={STATUS.REJECTED.accentBorder}
          isSelected={statusFilter === 'REJECTED'}
          onClick={() => handleKpiClick('REJECTED')}
          ariaLabel={`${getStatusLabel('REJECTED')}: ${kpiCounts.rejected}. Click to filter.`}
        />
        <KpiCard
          label={getStatusLabel('RETURNED')}
          count={kpiCounts.returned}
          accentBorder={STATUS.RETURNED.accentBorder}
          isSelected={statusFilter === 'RETURNED'}
          onClick={() => handleKpiClick('RETURNED')}
          ariaLabel={`${getStatusLabel('RETURNED')}: ${kpiCounts.returned}. Click to filter.`}
        />
        <KpiCard
          label={getStatusLabel('DRAFT')}
          count={kpiCounts.draft}
          accentBorder={STATUS.DRAFT.accentBorder}
          isSelected={statusFilter === 'DRAFT'}
          onClick={() => handleKpiClick('DRAFT')}
          ariaLabel={`${getStatusLabel('DRAFT')}: ${kpiCounts.draft}. Click to filter.`}
        />
        <KpiCard
          label={getStatusLabel('CANCELLED')}
          count={kpiCounts.cancelled}
          accentBorder={STATUS.CANCELLED.accentBorder}
          isSelected={statusFilter === 'CANCELLED'}
          onClick={() => handleKpiClick('CANCELLED')}
          ariaLabel={`${getStatusLabel('CANCELLED')}: ${kpiCounts.cancelled}. Click to filter.`}
        />
      </div>

      {/* Filter Toolbar */}
      <AdminFilterToolbar
        search={search}
        onSearchChange={setSearch}
        status={statusFilter}
        onStatusChange={(newStatus) => {
          setStatusFilter(newStatus);
          setPage(1);
        }}
        type={typeFilter}
        onTypeChange={(newType) => {
          setTypeFilter(newType);
          setPage(1);
        }}
        department={departmentFilter}
        onDepartmentChange={(newDept) => {
          setDepartmentFilter(newDept);
          setPage(1);
        }}
        departments={departments}
        startDate={startDateFilter}
        onStartDateChange={(newStart) => {
          setStartDateFilter(newStart);
          setPage(1);
        }}
        endDate={endDateFilter}
        onEndDateChange={(newEnd) => {
          setEndDateFilter(newEnd);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClearFilters}
      />

      {/* Admin Request Table */}
      <AdminRequestTable
        requests={displayedRequests}
        isLoading={isLoading}
        error={error}
        onRetry={fetchDashboardData}
        baseRoute="/request"
        page={page}
        pageSize={pageSize}
        totalCount={currentStatusTotal}
        hasMore={requests.length === pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Analytics Section (Below the Table) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
        {/* Card 1: Requests by status */}
        <Bars
          title="Requests by status"
          items={statusBarsData}
          total={kpiCounts.total}
          emptyMessage="No request status data recorded yet."
        />

        {/* Card 2: Requests by type */}
        <Bars
          title="Requests by type"
          items={typeBarsData}
          total={kpiCounts.total}
          emptyMessage="No request type distribution recorded yet."
        />
      </div>
    </AppShell>
  );
}
