import { RequestType, Priority } from '@prisma/client';

export type AttentionLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'NORMAL';

export type SlaStatus = 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'UNCONFIGURED';

export interface IntelligenceOverview {
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
  category: RequestType;
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
  slaStatus: SlaStatus;
  slaDetails: string;
  attentionLevel: AttentionLevel;
  attentionReason: string;
  isStuck: boolean;
  stuckReason?: string;
  priority: Priority;
  estimatedCost?: number;
  urgencyLevel?: string;
  requiredDate?: string;
  leaveStartDate?: string;
  leaveDays?: number;
}

export interface DepartmentBottleneck {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  pendingCount: number;
}

export interface CategoryBottleneck {
  category: RequestType;
  pendingCount: number;
}

export interface StageBottleneck {
  stageName: string;
  approverRole: string;
  pendingCount: number;
  avgWaitHours: number;
}

export interface BottlenecksData {
  byDepartment: DepartmentBottleneck[];
  byCategory: CategoryBottleneck[];
  byStage: StageBottleneck[];
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
  category: RequestType;
  departmentName: string;
  currentStage: string;
  priority: Priority;
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

export interface ChatQueryRequest {
  query: string;
  requestId?: string;
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
