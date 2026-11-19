import { AttentionRequestItem } from './types';

export interface SanitizedRequestDetails {
  id: string;
  referenceNumber: string;
  title: string;
  category: string;
  departmentName: string;
  priority: string;
  currentStage: string;
  currentApprover: string;
  timeAtStageFormatted: string;
  slaStatus: string;
  description: string;
  justification?: string;
  estimatedCost?: number;
  urgencyLevel?: string;
  requiredDate?: string;
  leaveType?: string;
  leaveDays?: number;
}

export interface AISummaryResponse {
  summaryText: string;
  missingInformation: string[];
  suggestedAttentionNote?: string;
  isAiGenerated: boolean;
  providerName: string;
}

export interface ApprovalIntelligenceProvider {
  readonly providerId: string;
  readonly isExternal: boolean;

  generateBriefingSummary(context: {
    totalPending: number;
    overdueCount: number;
    criticalCount: number;
    stuckCount: number;
    highestDept?: string;
    mostDelayedStage?: string;
  }): Promise<string>;

  summarizeRequest(request: SanitizedRequestDetails): Promise<AISummaryResponse>;

  answerChatQuery(query: string, verifiedFacts: {
    intent: string;
    count: number;
    items?: AttentionRequestItem[];
    departments?: Array<{ name: string; count: number }>;
  }): Promise<string>;
}
