import {
  ApprovalIntelligenceProvider,
  SanitizedRequestDetails,
  AISummaryResponse,
} from './provider.interface';
import { AttentionRequestItem } from './types';

/**
 * Local Deterministic Intelligence Provider
 * Runs 100% in-process with zero external API calls or data sharing.
 * Fulfills the ApprovalIntelligenceProvider contract using factual synthesis.
 */
export class LocalRuleBasedProvider implements ApprovalIntelligenceProvider {
  public readonly providerId = 'local-rule-based-v1';
  public readonly isExternal = false;

  async generateBriefingSummary(context: {
    totalPending: number;
    overdueCount: number;
    criticalCount: number;
    stuckCount: number;
    highestDept?: string;
    mostDelayedStage?: string;
  }): Promise<string> {
    const parts: string[] = [];

    parts.push(`There are currently ${context.totalPending} administrative request(s) awaiting approval across the hospital.`);

    if (context.criticalCount > 0) {
      parts.push(`${context.criticalCount} request(s) require critical attention due to urgent priorities, operational date breaches, or stalled routing.`);
    }

    if (context.overdueCount > 0) {
      parts.push(`${context.overdueCount} request(s) have exceeded standard review thresholds.`);
    }

    if (context.stuckCount > 0) {
      parts.push(`⚠️ ${context.stuckCount} request(s) are potentially stuck because no active approver is available to sign off.`);
    }

    if (context.highestDept) {
      parts.push(`The ${context.highestDept} department currently holds the highest pending volume.`);
    }

    if (context.mostDelayedStage) {
      parts.push(`The "${context.mostDelayedStage}" stage exhibits the longest average review duration.`);
    }

    return parts.join(' ');
  }

  async summarizeRequest(request: SanitizedRequestDetails): Promise<AISummaryResponse> {
    const lines: string[] = [];
    const missing: string[] = [];

    lines.push(`Requisition ${request.referenceNumber} is a ${request.priority} priority ${request.category} request originating from ${request.departmentName}.`);

    if (request.estimatedCost !== undefined) {
      lines.push(`The requisition entails an expenditure of ₹${request.estimatedCost.toLocaleString('en-IN')}.`);
    }

    if (request.requiredDate) {
      lines.push(`Requested completion/delivery date is ${new Date(request.requiredDate).toLocaleDateString()}.`);
    }

    if (request.leaveType && request.leaveDays) {
      lines.push(`Applies for ${request.leaveDays} day(s) of ${request.leaveType.toLowerCase()} leave.`);
    }

    lines.push(`Currently situated at "${request.currentStage}" (assigned to: ${request.currentApprover}) and has been pending at this stage for ${request.timeAtStageFormatted}.`);

    // Missing information checks (deterministic)
    if (!request.description || request.description.trim().length < 10) {
      missing.push('Comprehensive item/work description is minimal or absent.');
    }
    if (request.category === 'PURCHASE' && (!request.justification || request.justification.trim().length < 5)) {
      missing.push('Procurement business justification not provided.');
    }
    if (request.category === 'MAINTENANCE' && !request.urgencyLevel) {
      missing.push('Maintenance urgency/severity classification missing.');
    }

    let suggestedAttentionNote: string | undefined;
    if (request.slaStatus === 'OVERDUE') {
      suggestedAttentionNote = 'Approval timeframe has exceeded configured thresholds; administrative follow-up with the current approver is advised.';
    } else if (request.priority === 'EMERGENCY') {
      suggestedAttentionNote = 'Emergency classification requires priority processing.';
    }

    return {
      summaryText: lines.join(' '),
      missingInformation: missing,
      suggestedAttentionNote,
      isAiGenerated: true,
      providerName: 'E-Office Deterministic Intelligence',
    };
  }

  async answerChatQuery(
    query: string,
    verifiedFacts: {
      intent: string;
      count: number;
      items?: AttentionRequestItem[];
      departments?: Array<{ name: string; count: number }>;
    }
  ): Promise<string> {
    switch (verifiedFacts.intent) {
      case 'ATTENTION_TODAY':
        return `There are ${verifiedFacts.count} request(s) flagged for attention today based on urgency, age, and approver assignment.`;
      case 'OVERDUE':
        return `Found ${verifiedFacts.count} overdue approval(s) exceeding normal hospital response thresholds.`;
      case 'CATEGORY':
        return `There are currently ${verifiedFacts.count} pending request(s) under this category.`;
      case 'ROLE_PENDING':
        return `Currently ${verifiedFacts.count} request(s) are pending review at this approval role.`;
      case 'STUCK':
        return verifiedFacts.count > 0
          ? `Detected ${verifiedFacts.count} potentially stuck request(s) where approvers are inactive or missing.`
          : 'No stuck requests detected. All in-review requests have valid approver paths.';
      case 'DEPARTMENT_WORKLOAD':
        if (verifiedFacts.departments && verifiedFacts.departments.length > 0) {
          const top = verifiedFacts.departments[0]!;
          return `The department with the highest pending workload is ${top.name} with ${top.count} pending request(s).`;
        }
        return 'No departmental bottleneck data available.';
      case 'WAITING_LONG':
        return `There are ${verifiedFacts.count} request(s) that have been waiting at their current stage for more than 24 hours.`;
      case 'EXPLAIN_REQUEST':
        if (verifiedFacts.items && verifiedFacts.items.length > 0) {
          const req = verifiedFacts.items[0]!;
          return `Request ${req.referenceNumber} (${req.title}) is at stage "${req.currentStageName}". Current status: ${req.attentionReason}. Time at stage: ${req.timeAtCurrentStageFormatted}.`;
        }
        return 'Could not locate the requested requisition reference.';
      default:
        return `Here are the verified records matching your query (${verifiedFacts.count} found).`;
    }
  }
}
