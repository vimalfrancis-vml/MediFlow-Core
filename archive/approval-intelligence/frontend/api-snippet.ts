/**
 * Approval Intelligence API Client Snippet
 * Contains the TypeScript interfaces and API methods originally integrated in client/src/services/api.ts
 */

export interface IntelligenceOverviewData {
  requestsReceivedToday: number;
  totalPendingRequests: number;
  criticalAttentionRequests: number;
  overdueApprovals: number;
  potentiallyStuckRequests: number;
  asOf: string;
}

export interface AttentionRequestItem {
  id: string;
  referenceNumber: string;
  title: string;
  category: string;
  departmentName: string;
  departmentCode: string;
  submittedAt: string | null;
  createdAt: string;
  currentStageName: string;
  currentStageOrder: number;
  currentApproverRole: string;
  currentApproverDisplay: string;
  timeAtCurrentStageMinutes: number;
  timeAtCurrentStageFormatted: string;
  slaStatus: 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'UNCONFIGURED';
  slaDetails: string;
  attentionLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';
  attentionReason: string;
  isStuck: boolean;
  stuckReason?: string;
  priority: string;
  estimatedCost?: number;
  urgencyLevel?: string;
  requiredDate?: string;
  leaveStartDate?: string;
  leaveDays?: number;
}

export interface BottlenecksData {
  byDepartment: Array<{ departmentId: string; departmentName: string; departmentCode: string; pendingCount: number }>;
  byCategory: Array<{ category: string; pendingCount: number }>;
  byStage: Array<{ stageName: string; approverRole: string; pendingCount: number; avgWaitHours: number }>;
  stuckRequests: AttentionRequestItem[];
  slaNotice: string;
}

export interface DailyBriefingData {
  title: string;
  summary: string;
  totalPending: number;
  overdueCount: number;
  criticalCount: number;
  highestWorkloadDepartment: { name: string; count: number } | null;
  mostDelayedStage: { name: string; avgHours: number } | null;
  stuckCount: number;
  asOf: string;
}

export interface RequestSummaryResult {
  requestId: string;
  referenceNumber: string;
  title: string;
  category: string;
  departmentName: string;
  currentStage: string;
  priority: string;
  factualOverview: {
    submittedAt: string | null;
    waitDuration: string;
    assignedApprover: string;
    financialAmount?: number;
    keyDates?: string;
  };
  aiInterpretation: {
    summaryText: string;
    missingInformation?: string[];
    suggestedAttentionNote?: string;
    isAiGenerated: boolean;
    disclaimer: string;
  };
}

export interface ChatQueryResponse {
  intent: string;
  textAnswer: string;
  verifiedData: {
    count?: number;
    metrics?: Record<string, any>;
    requests?: AttentionRequestItem[];
  };
  disclaimer: string;
  suggestedFollowUps?: string[];
}

/**
 * Methods to add back to the `api` object in client/src/services/api.ts:
 */
export const approvalIntelligenceApiMethods = {
  getIntelligenceOverview(requestFn: Function) {
    return requestFn('/approval-intelligence/overview');
  },

  getIntelligenceAttentionList(requestFn: Function, params?: { category?: string; level?: string; limit?: number }) {
    let url = '/approval-intelligence/attention-list';
    if (params) {
      const qs = new URLSearchParams();
      if (params.category) qs.append('category', params.category);
      if (params.level) qs.append('level', params.level);
      if (params.limit) qs.append('limit', params.limit.toString());
      const str = qs.toString();
      if (str) url += `?${str}`;
    }
    return requestFn(url);
  },

  getIntelligenceBottlenecks(requestFn: Function) {
    return requestFn('/approval-intelligence/bottlenecks');
  },

  getIntelligenceDailyBriefing(requestFn: Function) {
    return requestFn('/approval-intelligence/daily-briefing');
  },

  getRequestIntelligenceSummary(requestFn: Function, id: string) {
    return requestFn(`/approval-intelligence/requests/${id}/summary`);
  },

  postIntelligenceChat(requestFn: Function, query: string, requestId?: string) {
    return requestFn('/approval-intelligence/chat', {
      method: 'POST',
      body: JSON.stringify({ query, requestId }),
    });
  }
};
