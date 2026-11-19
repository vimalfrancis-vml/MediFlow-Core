import { prisma } from '../../db';
import { RequestStatus, RequestType, Priority, UserRole } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import {
  IntelligenceOverview,
  AttentionRequestItem,
  AttentionLevel,
  SlaStatus,
  BottlenecksData,
  DailyBriefingData,
  RequestSummaryResult,
  ChatQueryResponse,
} from './types';
import { sanitizeRequestText, sanitizeLeaveReason } from './dataMinimizer';
import { LocalRuleBasedProvider } from './local.provider';
import { ApprovalIntelligenceProvider } from './provider.interface';

// Configurable hospital SLA waiting thresholds (hours at current stage)
const SLA_THRESHOLDS_HOURS: Record<Priority, number> = {
  [Priority.EMERGENCY]: 12,
  [Priority.HIGH]: 24,
  [Priority.NORMAL]: 48,
  [Priority.LOW]: 72,
};

export class ApprovalIntelligenceService {
  private static provider: ApprovalIntelligenceProvider = new LocalRuleBasedProvider();

  /**
   * Pluggable provider setter (for testing or future approved external provider)
   */
  public static setProvider(provider: ApprovalIntelligenceProvider) {
    this.provider = provider;
  }

  /**
   * Calculates overall high-level counts and factual metrics for the dashboard header.
   */
  public static async getOverview(): Promise<IntelligenceOverview> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [receivedTodayCount, pendingRequests] = await Promise.all([
      // Requests received or submitted today
      prisma.request.count({
        where: {
          deletedAt: null,
          OR: [
            { submittedAt: { gte: startOfToday } },
            { createdAt: { gte: startOfToday } },
          ],
        },
      }),
      // All pending review requests
      this.fetchPendingRequestsWithDetails(),
    ]);

    const analyzed = await this.analyzePendingRequests(pendingRequests, now);

    const criticalCount = analyzed.filter((r) => r.attentionLevel === 'CRITICAL').length;
    const overdueCount = analyzed.filter((r) => r.slaStatus === 'OVERDUE').length;
    const stuckCount = analyzed.filter((r) => r.isStuck).length;

    return {
      requestsReceivedToday: receivedTodayCount,
      totalPendingRequests: pendingRequests.length,
      criticalAttentionRequests: criticalCount,
      overdueApprovals: overdueCount,
      potentiallyStuckRequests: stuckCount,
      asOf: now.toISOString(),
    };
  }

  /**
   * Generates the ranked "Today's Attention List" of pending requests.
   */
  public static async getAttentionList(options?: {
    category?: RequestType;
    level?: AttentionLevel;
    limit?: number;
  }): Promise<AttentionRequestItem[]> {
    const now = new Date();
    const pendingRequests = await this.fetchPendingRequestsWithDetails(options?.category);
    let analyzed = await this.analyzePendingRequests(pendingRequests, now);

    if (options?.level) {
      analyzed = analyzed.filter((r) => r.attentionLevel === options.level);
    }

    // Rank by severity: CRITICAL (1) > HIGH (2) > MEDIUM (3) > NORMAL (4)
    // Secondary sort: longest time at current stage
    const severityOrder: Record<AttentionLevel, number> = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      NORMAL: 4,
    };

    analyzed.sort((a, b) => {
      const diff = severityOrder[a.attentionLevel] - severityOrder[b.attentionLevel];
      if (diff !== 0) return diff;
      return b.timeAtCurrentStageMinutes - a.timeAtCurrentStageMinutes;
    });

    if (options?.limit && options.limit > 0) {
      analyzed = analyzed.slice(0, options.limit);
    }

    return analyzed;
  }

  /**
   * Computes aggregated department and workflow bottleneck data.
   */
  public static async getBottlenecks(): Promise<BottlenecksData> {
    const now = new Date();
    const pendingRequests = await this.fetchPendingRequestsWithDetails();
    const analyzed = await this.analyzePendingRequests(pendingRequests, now);

    // 1. Pending by Department
    const deptMap = new Map<string, { name: string; code: string; count: number }>();
    for (const r of analyzed) {
      const key = r.departmentName;
      const existing = deptMap.get(key) || { name: r.departmentName, code: r.departmentCode, count: 0 };
      existing.count++;
      deptMap.set(key, existing);
    }
    const byDepartment = Array.from(deptMap.entries())
      .map(([_, v]) => ({
        departmentId: v.code,
        departmentName: v.name,
        departmentCode: v.code,
        pendingCount: v.count,
      }))
      .sort((a, b) => b.pendingCount - a.pendingCount);

    // 2. Pending by Category
    const catMap: Record<RequestType, number> = {
      PURCHASE: 0,
      MAINTENANCE: 0,
      LEAVE: 0,
      GENERAL: 0,
    };
    for (const r of analyzed) {
      catMap[r.category] = (catMap[r.category] || 0) + 1;
    }
    const byCategory = Object.entries(catMap).map(([category, pendingCount]) => ({
      category: category as RequestType,
      pendingCount,
    }));

    // 3. Stage Delays
    const stageMap = new Map<string, { role: string; count: number; totalMinutes: number }>();
    for (const r of analyzed) {
      const stageKey = r.currentStageName || 'Unknown Stage';
      const existing = stageMap.get(stageKey) || {
        role: r.currentApproverRole,
        count: 0,
        totalMinutes: 0,
      };
      existing.count++;
      existing.totalMinutes += r.timeAtCurrentStageMinutes;
      stageMap.set(stageKey, existing);
    }

    const byStage = Array.from(stageMap.entries())
      .map(([stageName, v]) => ({
        stageName,
        approverRole: v.role,
        pendingCount: v.count,
        avgWaitHours: Math.round((v.totalMinutes / v.count / 60) * 10) / 10,
      }))
      .sort((a, b) => b.avgWaitHours - a.avgWaitHours);

    // 4. Stuck Requests
    const stuckRequests = analyzed.filter((r) => r.isStuck);

    return {
      byDepartment,
      byCategory,
      byStage,
      stuckRequests,
      slaNotice:
        'SLA thresholds are evaluated using hospital standards: Emergency (12h), High (24h), Normal (48h), Low (72h). General and Leave requests additionally evaluate operational due dates.',
    };
  }

  /**
   * Generates the daily briefing displayed at the top of the dashboard.
   */
  public static async getDailyBriefing(): Promise<DailyBriefingData> {
    const overview = await this.getOverview();
    const bottlenecks = await this.getBottlenecks();

    const topDept = bottlenecks.byDepartment[0]
      ? { name: bottlenecks.byDepartment[0].departmentName, count: bottlenecks.byDepartment[0].pendingCount }
      : null;

    const topStage = bottlenecks.byStage[0]
      ? { name: bottlenecks.byStage[0].stageName, avgHours: bottlenecks.byStage[0].avgWaitHours }
      : null;

    const summary = await this.provider.generateBriefingSummary({
      totalPending: overview.totalPendingRequests,
      overdueCount: overview.overdueApprovals,
      criticalCount: overview.criticalAttentionRequests,
      stuckCount: overview.potentiallyStuckRequests,
      highestDept: topDept?.name,
      mostDelayedStage: topStage?.name,
    });

    return {
      title: "Today's Approval Briefing",
      summary,
      totalPending: overview.totalPendingRequests,
      overdueCount: overview.overdueApprovals,
      criticalCount: overview.criticalAttentionRequests,
      highestWorkloadDepartment: topDept,
      mostDelayedStage: topStage,
      stuckCount: overview.potentiallyStuckRequests,
      asOf: overview.asOf,
    };
  }

  /**
   * Provides an on-demand, privacy-redacted intelligence summary of an individual request.
   */
  public static async getRequestSummary(requestId: string): Promise<RequestSummaryResult> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        department: true,
        currentStep: true,
        assignedToUser: true,
        purchaseDetail: true,
        maintenanceDetail: true,
        leaveDetail: true,
        generalDetail: true,
        approvalActions: {
          orderBy: { takenAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!request) {
      throw new AppError('Request not found', 404);
    }

    const now = new Date();
    const [analyzedItem] = await this.analyzePendingRequests([request], now);
    if (!analyzedItem) {
      throw new AppError('Failed to analyze request', 500);
    }

    // Prepare privacy-redacted details for intelligence processing
    let rawDescription = '';
    let rawJustification = '';
    let estimatedCost: number | undefined;
    let urgencyLevel: string | undefined;
    let requiredDate: string | undefined;
    let leaveType: string | undefined;
    let leaveDays: number | undefined;

    if (request.purchaseDetail) {
      rawDescription = request.purchaseDetail.itemDescription;
      rawJustification = request.purchaseDetail.justification;
      estimatedCost = Number(request.purchaseDetail.estimatedCost);
    } else if (request.maintenanceDetail) {
      rawDescription = `${request.maintenanceDetail.equipmentName} at ${request.maintenanceDetail.location}: ${request.maintenanceDetail.issueDescription}`;
      urgencyLevel = request.maintenanceDetail.urgencyLevel;
    } else if (request.leaveDetail) {
      rawDescription = sanitizeLeaveReason(request.leaveDetail.reason);
      leaveType = request.leaveDetail.leaveType;
      leaveDays = request.leaveDetail.totalDays;
    } else if (request.generalDetail) {
      rawDescription = `${request.generalDetail.subject}: ${request.generalDetail.description}`;
      if (request.generalDetail.requiredDate) {
        requiredDate = request.generalDetail.requiredDate.toISOString();
      }
    }

    const sanitizedDetails = {
      id: request.id,
      referenceNumber: request.referenceNumber,
      title: sanitizeRequestText(request.title),
      category: request.type,
      departmentName: request.department.name,
      priority: request.priority,
      currentStage: analyzedItem.currentStageName,
      currentApprover: analyzedItem.currentApproverDisplay,
      timeAtStageFormatted: analyzedItem.timeAtCurrentStageFormatted,
      slaStatus: analyzedItem.slaStatus,
      description: sanitizeRequestText(rawDescription),
      justification: sanitizeRequestText(rawJustification),
      estimatedCost,
      urgencyLevel,
      requiredDate,
      leaveType,
      leaveDays,
    };

    const aiRes = await this.provider.summarizeRequest(sanitizedDetails);

    return {
      requestId: request.id,
      referenceNumber: request.referenceNumber,
      title: request.title,
      category: request.type,
      departmentName: request.department.name,
      currentStage: analyzedItem.currentStageName,
      priority: request.priority,
      factualOverview: {
        submittedAt: request.submittedAt ? request.submittedAt.toISOString() : null,
        waitDuration: analyzedItem.timeAtCurrentStageFormatted,
        assignedApprover: analyzedItem.currentApproverDisplay,
        financialAmount: estimatedCost,
        keyDates: requiredDate || (request.leaveDetail ? `${new Date(request.leaveDetail.startDate).toLocaleDateString()} to ${new Date(request.leaveDetail.endDate).toLocaleDateString()}` : undefined),
      },
      aiInterpretation: {
        summaryText: aiRes.summaryText,
        missingInformation: aiRes.missingInformation,
        suggestedAttentionNote: aiRes.suggestedAttentionNote,
        isAiGenerated: true,
        disclaimer: 'AI-generated synthesis. Please verify against original hospital request records before taking executive action.',
      },
    };
  }

  /**
   * Answers constrained, read-only administrative chatbot queries.
   */
  public static async processChatQuery(query: string, specificRequestId?: string): Promise<ChatQueryResponse> {
    const q = query.toLowerCase().trim();

    // 1. Specific Request Lookup
    const refMatch = q.match(/\b(req|pr|mr|lr|gr)-[a-z0-9-]+\b/i);
    if (refMatch || specificRequestId) {
      const ref = refMatch ? refMatch[0].toUpperCase() : undefined;
      const request = await prisma.request.findFirst({
        where: specificRequestId ? { id: specificRequestId } : { referenceNumber: { equals: ref, mode: 'insensitive' } },
        include: {
          department: true,
          currentStep: true,
          assignedToUser: true,
          purchaseDetail: true,
          maintenanceDetail: true,
          leaveDetail: true,
          generalDetail: true,
          approvalActions: { orderBy: { takenAt: 'desc' }, take: 1 },
        },
      });

      if (request) {
        const analyzed = await this.analyzePendingRequests([request], new Date());
        const item = analyzed[0]!;
        const textAnswer = await this.provider.answerChatQuery(query, {
          intent: 'EXPLAIN_REQUEST',
          count: 1,
          items: [item],
        });

        return {
          intent: 'EXPLAIN_REQUEST',
          textAnswer,
          verifiedData: { count: 1, requests: [item] },
          disclaimer: 'Verified system data. AI output is for contextual guidance only.',
          suggestedFollowUps: ['Show all overdue approvals', 'What needs my attention today?'],
        };
      }
    }

    // 2. Overdue Approvals
    if (q.includes('overdue') || q.includes('delayed') || q.includes('late')) {
      const items = await this.getAttentionList();
      const overdue = items.filter((i) => i.slaStatus === 'OVERDUE');
      const textAnswer = await this.provider.answerChatQuery(query, {
        intent: 'OVERDUE',
        count: overdue.length,
        items: overdue,
      });

      return {
        intent: 'OVERDUE',
        textAnswer,
        verifiedData: { count: overdue.length, requests: overdue },
        disclaimer: 'Verified system data based on configured review thresholds.',
        suggestedFollowUps: ['Which requests are potentially stuck?', 'Show department bottlenecks'],
      };
    }

    // 3. Category Queries (Purchase, Maintenance, Leave, General)
    if (q.includes('purchase')) {
      const items = await this.getAttentionList({ category: 'PURCHASE' });
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'CATEGORY', count: items.length, items });
      return {
        intent: 'CATEGORY_PURCHASE',
        textAnswer,
        verifiedData: { count: items.length, requests: items },
        disclaimer: 'Verified system data.',
      };
    }
    if (q.includes('maintenance')) {
      const items = await this.getAttentionList({ category: 'MAINTENANCE' });
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'CATEGORY', count: items.length, items });
      return {
        intent: 'CATEGORY_MAINTENANCE',
        textAnswer,
        verifiedData: { count: items.length, requests: items },
        disclaimer: 'Verified system data.',
      };
    }
    if (q.includes('leave')) {
      const items = await this.getAttentionList({ category: 'LEAVE' });
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'CATEGORY', count: items.length, items });
      return {
        intent: 'CATEGORY_LEAVE',
        textAnswer,
        verifiedData: { count: items.length, requests: items },
        disclaimer: 'Verified system data.',
      };
    }
    if (q.includes('general')) {
      const items = await this.getAttentionList({ category: 'GENERAL' });
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'CATEGORY', count: items.length, items });
      return {
        intent: 'CATEGORY_GENERAL',
        textAnswer,
        verifiedData: { count: items.length, requests: items },
        disclaimer: 'Verified system data.',
      };
    }

    // 4. Role Queries (Finance, HOD, Director, Procurement)
    if (q.includes('finance')) {
      const items = await this.getAttentionList();
      const filtered = items.filter((i) => i.currentApproverRole === 'FINANCE_OFFICER');
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'ROLE_PENDING', count: filtered.length, items: filtered });
      return {
        intent: 'ROLE_FINANCE',
        textAnswer,
        verifiedData: { count: filtered.length, requests: filtered },
        disclaimer: 'Verified system data.',
      };
    }
    if (q.includes('hod')) {
      const items = await this.getAttentionList();
      const filtered = items.filter((i) => i.currentApproverRole === 'HOD');
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'ROLE_HOD', count: filtered.length, items: filtered });
      return {
        intent: 'ROLE_HOD',
        textAnswer,
        verifiedData: { count: filtered.length, requests: filtered },
        disclaimer: 'Verified system data.',
      };
    }

    // 5. Stuck Requests / No Approver
    if (q.includes('stuck') || q.includes('no approver') || q.includes('unassigned')) {
      const items = await this.getAttentionList();
      const stuck = items.filter((i) => i.isStuck);
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'STUCK', count: stuck.length, items: stuck });
      return {
        intent: 'STUCK_REQUESTS',
        textAnswer,
        verifiedData: { count: stuck.length, requests: stuck },
        disclaimer: 'Verified system data.',
      };
    }

    // 6. Waiting > 24 hours
    if (q.includes('24 hour') || q.includes('24h') || q.includes('waiting long')) {
      const items = await this.getAttentionList();
      const waitingLong = items.filter((i) => i.timeAtCurrentStageMinutes >= 24 * 60);
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'WAITING_LONG', count: waitingLong.length, items: waitingLong });
      return {
        intent: 'WAITING_LONG',
        textAnswer,
        verifiedData: { count: waitingLong.length, requests: waitingLong },
        disclaimer: 'Verified system data.',
      };
    }

    // 7. Department Workload
    if (q.includes('department') || q.includes('workload') || q.includes('highest')) {
      const bottlenecks = await this.getBottlenecks();
      const depts = bottlenecks.byDepartment.map((d) => ({ name: d.departmentName, count: d.pendingCount }));
      const textAnswer = await this.provider.answerChatQuery(query, { intent: 'DEPARTMENT_WORKLOAD', count: depts.length, departments: depts });
      return {
        intent: 'DEPARTMENT_WORKLOAD',
        textAnswer,
        verifiedData: { metrics: { departments: depts } },
        disclaimer: 'Verified system data.',
      };
    }

    // Default / "What needs my attention today?"
    const items = await this.getAttentionList({ limit: 5 });
    const textAnswer = await this.provider.answerChatQuery(query, { intent: 'ATTENTION_TODAY', count: items.length, items });
    return {
      intent: 'ATTENTION_TODAY',
      textAnswer,
      verifiedData: { count: items.length, requests: items },
      disclaimer: 'Verified system data ranked by severity.',
      suggestedFollowUps: ['Show overdue approvals', 'Which requests are potentially stuck?', 'Which department has the highest pending workload?'],
    };
  }

  // --- INTERNAL DETERMINISTIC HELPERS ---

  private static async fetchPendingRequestsWithDetails(category?: RequestType) {
    const where: any = {
      status: RequestStatus.IN_REVIEW,
      deletedAt: null,
    };
    if (category) {
      where.type = category;
    }

    return prisma.request.findMany({
      where,
      include: {
        department: true,
        requestedBy: {
          select: { id: true, firstName: true, lastName: true, role: true, departmentId: true },
        },
        currentStep: true,
        assignedToUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true, deletedAt: true },
        },
        purchaseDetail: true,
        maintenanceDetail: true,
        leaveDetail: true,
        generalDetail: true,
        approvalActions: {
          orderBy: { takenAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  private static async analyzePendingRequests(
    requests: any[],
    now: Date
  ): Promise<AttentionRequestItem[]> {
    const result: AttentionRequestItem[] = [];

    // Preload all active users grouped by role and department for fast in-memory eligibility resolution
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, role: true, departmentId: true },
    });

    for (const req of requests) {
      // 1. Calculate time spent at current stage
      // If approval actions exist, duration is from latest action takenAt; otherwise from submittedAt / createdAt
      const stageEntryTime = req.approvalActions[0]?.takenAt || req.submittedAt || req.createdAt;
      const timeAtCurrentStageMinutes = Math.max(0, Math.floor((now.getTime() - new Date(stageEntryTime).getTime()) / (1000 * 60)));
      const timeAtCurrentStageFormatted = this.formatDuration(timeAtCurrentStageMinutes);

      // 2. Identify Approver & Stuck condition
      let isStuck = false;
      let stuckReason: string | undefined;
      let approverDisplay = 'Unassigned';
      const currentRole = req.currentStep?.approverRole || 'UNKNOWN';

      if (req.assignedToUserId && req.assignedToUser) {
        if (!req.assignedToUser.isActive || req.assignedToUser.deletedAt) {
          isStuck = true;
          stuckReason = `Assigned approver (${req.assignedToUser.firstName} ${req.assignedToUser.lastName}) is inactive or deactivated.`;
          approverDisplay = `${req.assignedToUser.firstName} ${req.assignedToUser.lastName} (Inactive)`;
        } else {
          approverDisplay = `${req.assignedToUser.firstName} ${req.assignedToUser.lastName}`;
        }
      } else if (!req.currentStep) {
        isStuck = true;
        stuckReason = 'Request is in review but has no active current workflow stage.';
        approverDisplay = 'Missing Stage';
      } else if (req.type === RequestType.GENERAL) {
        // General Request: check target department eligible users
        const targetDeptId = req.generalDetail?.targetDepartmentId;
        if (!targetDeptId) {
          isStuck = true;
          stuckReason = 'General request lacks target department and assigned reviewer.';
          approverDisplay = 'Missing Destination';
        } else {
          const eligibleInTarget = activeUsers.filter(
            (u) => u.departmentId === targetDeptId && u.role !== UserRole.ADMIN && u.id !== req.requestedById
          );
          if (eligibleInTarget.length === 0) {
            isStuck = true;
            stuckReason = 'Target department has no active hospital staff available to fulfill this request.';
            approverDisplay = 'Target Dept Empty';
          } else {
            approverDisplay = `${eligibleInTarget.length} eligible reviewer(s) in department`;
          }
        }
      } else {
        // Standard Workflow Step approver pool check
        const targetDeptId =
          req.currentStep.approverRole === UserRole.HOD
            ? req.departmentId
            : req.currentStep.approverDepartmentId;

        const eligibleApprovers = activeUsers.filter((u) => {
          if (u.id === req.requestedById) return false; // Self-approval prevention
          if (u.role !== req.currentStep.approverRole) return false;
          if (targetDeptId && u.departmentId !== targetDeptId) return false;
          return true;
        });

        if (eligibleApprovers.length === 0) {
          isStuck = true;
          stuckReason = `No active user with role ${req.currentStep.approverRole.replace(/_/g, ' ')} found in ${targetDeptId ? 'the required department' : 'system'}.`;
          approverDisplay = 'No Active Approver';
        } else {
          approverDisplay = `${req.currentStep.approverRole.replace(/_/g, ' ')} (${eligibleApprovers.length} available)`;
        }
      }

      // 3. Calculate SLA / Deadline Status
      const thresholdHours = SLA_THRESHOLDS_HOURS[req.priority as Priority] || 48;
      const waitingHours = timeAtCurrentStageMinutes / 60;
      let slaStatus: SlaStatus = 'ON_TRACK';
      let slaDetails = `Within expected threshold (< ${thresholdHours}h)`;

      // Date-based deadlines (General requiredDate / Leave startDate)
      let dateBreached = false;
      let dateDueSoon = false;

      if (req.generalDetail?.requiredDate) {
        const reqDate = new Date(req.generalDetail.requiredDate);
        if (reqDate.getTime() < now.getTime()) {
          dateBreached = true;
          const diffHours = Math.round((now.getTime() - reqDate.getTime()) / (1000 * 3600));
          slaDetails = `Required delivery date (${reqDate.toLocaleDateString()}) breached by ${diffHours}h`;
        } else if (reqDate.getTime() - now.getTime() < 24 * 3600 * 1000) {
          dateDueSoon = true;
          slaDetails = `Required date (${reqDate.toLocaleDateString()}) is due within 24h`;
        }
      }

      if (req.leaveDetail?.startDate) {
        const startDate = new Date(req.leaveDetail.startDate);
        if (startDate.getTime() < now.getTime()) {
          dateBreached = true;
          slaDetails = `Leave start date (${startDate.toLocaleDateString()}) has already passed`;
        } else if (startDate.getTime() - now.getTime() < 48 * 3600 * 1000) {
          dateDueSoon = true;
          slaDetails = `Leave starts on ${startDate.toLocaleDateString()} (within 48h)`;
        }
      }

      if (dateBreached || waitingHours > thresholdHours) {
        slaStatus = 'OVERDUE';
        if (!dateBreached) {
          const overdueByHours = Math.round((waitingHours - thresholdHours) * 10) / 10;
          slaDetails = `Exceeded ${thresholdHours}h review threshold by ${overdueByHours}h`;
        }
      } else if (dateDueSoon || thresholdHours - waitingHours < 8) {
        slaStatus = 'DUE_SOON';
        if (!dateDueSoon) {
          const remaining = Math.round((thresholdHours - waitingHours) * 10) / 10;
          slaDetails = `Threshold expires in ${remaining}h`;
        }
      }

      // 4. Calculate Attention Level & Generate Explainable Reason
      let attentionLevel: AttentionLevel = 'NORMAL';
      let attentionReason = 'Progressing normally within expected operational timeline.';

      const cost = req.purchaseDetail ? Number(req.purchaseDetail.estimatedCost) : undefined;

      if (req.priority === Priority.EMERGENCY || isStuck || dateBreached || waitingHours >= thresholdHours * 2) {
        attentionLevel = 'CRITICAL';
        if (isStuck) {
          attentionReason = `Stalled approval: ${stuckReason}`;
        } else if (req.priority === Priority.EMERGENCY) {
          attentionReason = 'Emergency priority requisition requires prompt administrative review.';
        } else if (dateBreached) {
          attentionReason = `Operational deadline passed: ${slaDetails}.`;
        } else {
          attentionReason = `Severe delay: Waiting at current stage for ${timeAtCurrentStageFormatted} (over 2x SLA threshold).`;
        }
      } else if (req.priority === Priority.HIGH || slaStatus === 'OVERDUE' || (cost && cost > 100000 && waitingHours >= 24)) {
        attentionLevel = 'HIGH';
        if (slaStatus === 'OVERDUE') {
          attentionReason = `Overdue: ${slaDetails}.`;
        } else if (cost && cost > 100000) {
          attentionReason = `High-value purchase (₹${cost.toLocaleString('en-IN')}) pending review for ${timeAtCurrentStageFormatted}.`;
        } else {
          attentionReason = `High priority requisition awaiting action at ${req.currentStep?.stepName || 'current stage'}.`;
        }
      } else if (waitingHours >= 24 || slaStatus === 'DUE_SOON') {
        attentionLevel = 'MEDIUM';
        attentionReason = slaStatus === 'DUE_SOON' ? `Impending deadline: ${slaDetails}.` : `Awaiting review for ${timeAtCurrentStageFormatted}.`;
      }

      result.push({
        id: req.id,
        referenceNumber: req.referenceNumber,
        title: req.title,
        category: req.type,
        departmentName: req.department.name,
        departmentCode: req.department.code,
        submittedAt: req.submittedAt ? req.submittedAt.toISOString() : null,
        createdAt: req.createdAt.toISOString(),
        currentStageName: req.currentStep?.stepName || 'Unassigned Stage',
        currentStageOrder: req.currentStep?.order || 0,
        currentApproverRole: currentRole,
        currentApproverDisplay: approverDisplay,
        timeAtCurrentStageMinutes,
        timeAtCurrentStageFormatted,
        slaStatus,
        slaDetails,
        attentionLevel,
        attentionReason,
        isStuck,
        stuckReason,
        priority: req.priority,
        estimatedCost: cost,
        urgencyLevel: req.maintenanceDetail?.urgencyLevel,
        requiredDate: req.generalDetail?.requiredDate?.toISOString(),
        leaveStartDate: req.leaveDetail?.startDate?.toISOString(),
        leaveDays: req.leaveDetail?.totalDays,
      });
    }

    return result;
  }

  private static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
}
