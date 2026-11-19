import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type IntelligenceOverviewData,
  type DailyBriefingData,
  type AttentionRequestItem,
  type BottlenecksData,
} from '../services/api';
import { DashboardLayout } from '../components/DashboardLayout';
import { AdminNav } from '../components/AdminNav';
import { LoadingState } from '../components/LoadingState';
import { ApprovalOverviewCards } from '../components/approval-intelligence/ApprovalOverviewCards';
import { DailyBriefing } from '../components/approval-intelligence/DailyBriefing';
import { TodayAttentionList } from '../components/approval-intelligence/TodayAttentionList';
import { BottlenecksPanel } from '../components/approval-intelligence/BottlenecksPanel';
import { ApprovalIntelligenceChat } from '../components/approval-intelligence/ApprovalIntelligenceChat';
import { RequestAISummaryModal } from '../components/approval-intelligence/RequestAISummaryModal';

export default function ApprovalIntelligencePage() {
  const [overview, setOverview] = useState<IntelligenceOverviewData | null>(null);
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefingData | null>(null);
  const [attentionList, setAttentionList] = useState<AttentionRequestItem[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottlenecksData | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>('');

  // Active view tab: 'attention' | 'bottlenecks' | 'chat'
  const [activeTab, setActiveTab] = useState<'attention' | 'bottlenecks' | 'chat'>('attention');

  // Quick filter from overview card selection
  const [selectedOverviewFilter, setSelectedOverviewFilter] = useState<string | null>(null);

  // Modal inspection
  const [selectedSummaryRequestId, setSelectedSummaryRequestId] = useState<string | null>(null);

  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [overviewRes, briefingRes, attentionRes, bottlenecksRes] = await Promise.all([
        api.getIntelligenceOverview(),
        api.getIntelligenceDailyBriefing(),
        api.getIntelligenceAttentionList(),
        api.getIntelligenceBottlenecks(),
      ]);

      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data);
      }
      if (briefingRes.success && briefingRes.data) {
        setDailyBriefing(briefingRes.data);
      }
      if (attentionRes.success && attentionRes.data) {
        setAttentionList(attentionRes.data);
      }
      if (bottlenecksRes.success && bottlenecksRes.data) {
        setBottlenecks(bottlenecksRes.data);
      }

      setLastRefreshedAt(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      setError(err.message || 'Failed to fetch approval intelligence data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOverviewFilterSelect = (filterKey: string | null) => {
    setSelectedOverviewFilter(filterKey);
    // Switch to attention list if a card filter is selected
    if (filterKey) {
      setActiveTab('attention');
    }
  };

  const getFilterDisplayName = (key: string | null) => {
    switch (key) {
      case 'today':
        return 'Received Today';
      case 'pending':
        return 'All In Review';
      case 'critical':
        return 'Critical Attention';
      case 'overdue':
        return 'Overdue Approvals';
      case 'stuck':
        return 'Potentially Stuck';
      default:
        return '';
    }
  };

  return (
    <DashboardLayout title="E-Office" brandPrefix="Admin" nav={<AdminNav />}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Admin Approval Intelligence
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Enterprise Oversight
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time administrative request oversight, delay detection, and executive summaries.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              Refreshed at {lastRefreshedAt}
            </span>
          )}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-60"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-700' : 'text-slate-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Error Notification */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            className="text-xs font-bold underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Initial Loading State */}
      {isLoading ? (
        <LoadingState message="Loading administrative approval intelligence..." />
      ) : (
        <>
          {/* Executive Daily Briefing */}
          {dailyBriefing && <DailyBriefing briefing={dailyBriefing} />}

          {/* KPI Overview Summary Cards */}
          {overview && (
            <ApprovalOverviewCards
              overview={overview}
              activeFilter={selectedOverviewFilter}
              onSelectFilter={handleOverviewFilterSelect}
            />
          )}

          {/* Filter Status Chip (if overview card selected) */}
          {selectedOverviewFilter && (
            <div className="flex items-center gap-2 mb-4 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
              <span className="font-semibold">Quick Filter Active:</span>
              <span className="font-bold bg-white px-2 py-0.5 rounded border border-blue-300">
                {getFilterDisplayName(selectedOverviewFilter)}
              </span>
              <button
                type="button"
                onClick={() => setSelectedOverviewFilter(null)}
                className="text-blue-700 hover:text-blue-900 font-bold ml-auto hover:underline"
              >
                Clear Filter
              </button>
            </div>
          )}

          {/* Module Navigation Tabs */}
          <div className="flex border-b border-slate-200 mb-6 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('attention')}
              className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'attention'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Today&apos;s Attention</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'attention'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {attentionList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bottlenecks')}
              className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'bottlenecks'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Bottlenecks & Delays</span>
              {bottlenecks && bottlenecks.stuckRequests.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  {bottlenecks.stuckRequests.length} stuck
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'chat'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>AI Intelligence Assistant</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Read-Only
              </span>
            </button>
          </div>

          {/* Tab Views */}
          {activeTab === 'attention' && (
            <TodayAttentionList
              items={attentionList}
              selectedOverviewFilter={selectedOverviewFilter}
              onOpenSummary={(item) => setSelectedSummaryRequestId(item.id)}
            />
          )}

          {activeTab === 'bottlenecks' && bottlenecks && (
            <BottlenecksPanel bottlenecks={bottlenecks} />
          )}

          {activeTab === 'chat' && <ApprovalIntelligenceChat />}
        </>
      )}

      {/* On-Demand AI Request Summary Modal */}
      {selectedSummaryRequestId && (
        <RequestAISummaryModal
          requestId={selectedSummaryRequestId}
          onClose={() => setSelectedSummaryRequestId(null)}
        />
      )}
    </DashboardLayout>
  );
}
