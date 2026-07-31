// src/request/request.service.ts

import { WorkflowEngine } from '../core/WorkflowEngine';
import { prisma } from '../db';
import { Request, RequestStatus, ApprovalActionType, UserRole } from '@prisma/client';
import { AuthUser } from '../core/WorkflowEngine'; // reuse interface
import { AppError } from '../middleware/errorHandler';

/**
 * Service layer for request operations. All business logic is delegated to the
 * WorkflowEngine. This layer only handles orchestration, permission checks that
 * are not covered by the engine, and shaping data for the controller.
 */
export class RequestService {
  /** Create a new request (draft) */
  /**
   * Create a new request (draft) and log an audit entry.
   * @param data   Request payload.
   * @param actor  Authenticated user performing the action.
   * @returns Created Request record.
   */
static async createRequest(data: any, actor: AuthUser): Promise<Request> {
    const referenceNumber = `REQ-${Date.now()}`;
    const { requestedById, departmentId, workflowTemplateId, details, ...cleanData } = data;
    
    // Resolve workflowTemplateId: use provided or fallback to a template matching request type
    let templateId = workflowTemplateId;
    if (!templateId) {
      const tmpl = await prisma.workflowTemplate.findFirst({
        where: { requestType: cleanData.type },
      });
      if (!tmpl) {
        throw new Error('No workflow template found for request type');
      }
      templateId = tmpl.id;
    }
    const requestData: any = {
        ...cleanData,
        requestedBy: { connect: { id: actor.id } },
        department: { connect: { id: actor.departmentId } },
        workflowTemplate: { connect: { id: templateId } },
        referenceNumber,
        status: RequestStatus.DRAFT,
    };
    if (cleanData.type === 'PURCHASE' && details) {
        const purchaseDetailData = {
            itemDescription: details.itemDescription || 'Default Item',
            quantity: details.quantity || 1,
            justification: details.justification || 'N/A',
            vendorName: details.vendorName,
            estimatedCost: details.estimatedCost,
            budgetCode: details.budgetCode,
        };
        requestData.purchaseDetail = { create: purchaseDetailData };
    } else if (cleanData.type === 'MAINTENANCE') {
        if (!details) {
            throw new AppError('Details are required for Maintenance requests.', 400);
        }
        if (!details.equipmentName || !details.equipmentName.trim()) {
            throw new AppError('Equipment name is required.', 400);
        }
        if (!details.location || !details.location.trim()) {
            throw new AppError('Location is required.', 400);
        }
        if (!details.issueDescription || !details.issueDescription.trim()) {
            throw new AppError('Issue description is required.', 400);
        }
        if (!details.urgencyLevel || !['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'].includes(details.urgencyLevel)) {
            throw new AppError('Urgency level must be Low, Normal, High, or Emergency.', 400);
        }

        const notesStr = details.notes && details.notes.trim() ? `\n\nNotes:\n${details.notes.trim()}` : '';
        const formattedDescription = `Issue Description:\n${details.issueDescription.trim()}${notesStr}`;

        requestData.maintenanceDetail = {
            create: {
                equipmentName: details.equipmentName.trim(),
                location: details.location.trim(),
                urgencyLevel: details.urgencyLevel,
                issueDescription: formattedDescription,
            }
        };
    } else if (cleanData.type === 'LEAVE') {
        if (!details) {
            throw new AppError('Details are required for Leave requests.', 400);
        }
        if (!details.leaveType || !details.leaveType.trim()) {
            throw new AppError('Leave type is required.', 400);
        }
        if (!details.startDate || !details.startDate.trim()) {
            throw new AppError('Start date is required.', 400);
        }
        if (!details.endDate || !details.endDate.trim()) {
            throw new AppError('End date is required.', 400);
        }
        if (!details.reason || !details.reason.trim()) {
            throw new AppError('Leave reason is required.', 400);
        }

        const startDate = new Date(details.startDate);
        const endDate = new Date(details.endDate);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            throw new AppError('Invalid date format.', 400);
        }
        if (endDate < startDate) {
            throw new AppError('End date cannot be before the start date.', 400);
        }

        const diffTime = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (totalDays <= 0) {
            throw new AppError('Total days must be greater than zero.', 400);
        }

        requestData.leaveDetail = {
            create: {
                leaveType: details.leaveType.trim(),
                startDate,
                endDate,
                totalDays,
                reason: details.reason.trim(),
                coveringStaff: details.coveringStaff ? details.coveringStaff.trim() : null,
            }
        };
    }
    const newRequest = await prisma.request.create({ data: requestData });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        requestId: newRequest.id,
        action: 'CREATED',
        description: `Request created by ${actor.firstName} ${actor.lastName}`,
      },
    });
    return newRequest;
  }

  /** Edit an existing draft request */
  /**
   * Edit an existing draft or returned request.
   * @param id   Request ID.
   * @param data Updated fields.
   * @param actor Authenticated user performing the edit.
   * @returns Updated Request record.
   */
  static async editRequest(id: string, data: any, actor: AuthUser): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({ where: { id } });
    if (request.requestedById !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new AppError('You are not allowed to edit this request.', 403);
    }
    if (request.status !== RequestStatus.DRAFT && request.status !== RequestStatus.RETURNED) {
      throw new AppError('Only draft or returned requests can be edited.', 400);
    }
    // Remove unsupported 'details' field before update
    const { details, ...cleanData } = data;
    
    const updateData: any = { ...cleanData };

    if (details) {
      if (request.type === 'PURCHASE') {
        updateData.purchaseDetail = { update: details };
      } else if (request.type === 'MAINTENANCE') {
        if (details.equipmentName !== undefined && !details.equipmentName.trim()) {
          throw new AppError('Equipment name is required.', 400);
        }
        if (details.location !== undefined && !details.location.trim()) {
          throw new AppError('Location is required.', 400);
        }
        if (details.issueDescription !== undefined && !details.issueDescription.trim()) {
          throw new AppError('Issue description is required.', 400);
        }
        if (details.urgencyLevel !== undefined && !['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'].includes(details.urgencyLevel)) {
          throw new AppError('Urgency level must be Low, Normal, High, or Emergency.', 400);
        }

        const existingDetail = await prisma.maintenanceDetail.findUniqueOrThrow({
          where: { requestId: id }
        });

        const finalDescription = details.issueDescription !== undefined ? details.issueDescription.trim() : null;
        const finalNotes = details.notes !== undefined ? details.notes.trim() : null;

        let formattedDescription = undefined;
        if (finalDescription !== null || finalNotes !== null) {
          let currentDesc = '';
          let currentNotes = '';
          const existingIssueDesc = existingDetail.issueDescription ?? '';
          if (existingIssueDesc.startsWith('Issue Description:\n')) {
            const parts = existingIssueDesc.split('\n\nNotes:\n');
            const descPart = parts[0] ?? '';
            const notesPart = parts[1] ?? '';
            currentDesc = descPart.replace('Issue Description:\n', '').trim();
            currentNotes = notesPart ? notesPart.trim() : '';
          } else {
            currentDesc = existingIssueDesc;
          }

          const descToUse = finalDescription !== null ? finalDescription : currentDesc;
          const notesToUse = finalNotes !== null ? finalNotes : currentNotes;
          const notesStr = notesToUse ? `\n\nNotes:\n${notesToUse}` : '';
          formattedDescription = `Issue Description:\n${descToUse}${notesStr}`;
        }

        updateData.maintenanceDetail = {
          update: {
            equipmentName: details.equipmentName !== undefined ? details.equipmentName.trim() : undefined,
            location: details.location !== undefined ? details.location.trim() : undefined,
            urgencyLevel: details.urgencyLevel !== undefined ? details.urgencyLevel : undefined,
            issueDescription: formattedDescription !== undefined ? formattedDescription : undefined,
          }
        };
      } else if (request.type === 'LEAVE') {
        if (details.leaveType !== undefined && !details.leaveType.trim()) {
          throw new AppError('Leave type is required.', 400);
        }
        if (details.reason !== undefined && !details.reason.trim()) {
          throw new AppError('Leave reason is required.', 400);
        }

        const existingDetail = await prisma.leaveDetail.findUniqueOrThrow({
          where: { requestId: id }
        });

        const startVal = details.startDate !== undefined ? details.startDate : existingDetail.startDate;
        const endVal = details.endDate !== undefined ? details.endDate : existingDetail.endDate;

        const startDate = new Date(startVal);
        const endDate = new Date(endVal);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new AppError('Invalid date format.', 400);
        }
        if (endDate < startDate) {
          throw new AppError('End date cannot be before the start date.', 400);
        }

        const diffTime = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (totalDays <= 0) {
          throw new AppError('Total days must be greater than zero.', 400);
        }

        updateData.leaveDetail = {
          update: {
            leaveType: details.leaveType !== undefined ? details.leaveType.trim() : undefined,
            startDate: details.startDate !== undefined ? startDate : undefined,
            endDate: details.endDate !== undefined ? endDate : undefined,
            totalDays,
            reason: details.reason !== undefined ? details.reason.trim() : undefined,
            coveringStaff: details.coveringStaff !== undefined ? (details.coveringStaff ? details.coveringStaff.trim() : null) : undefined,
          }
        };
      }
    }

    const updated = await prisma.request.update({
      where: { id },
      data: updateData,
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        requestId: id,
        action: 'UPDATED',
        description: `Request edited by ${actor.firstName} ${actor.lastName}`,
      },
    });
    return updated;
  }

  /** Submit a draft/returned request for review */
  /**
   * Submit a draft or returned request for review via WorkflowEngine.
   * @param id   Request ID.
   * @param actor Authenticated user submitting the request.
   * @returns Updated Request with status IN_REVIEW.
   */
  static async submitRequest(id: string, actor: AuthUser): Promise<Request> {
    return WorkflowEngine.submitRequest(id, actor);
  }

  /** Cancel a request */
  /**
   * Cancel a request and record the reason.
   * @param id     Request ID.
   * @param reason Optional cancellation reason.
   * @param actor  Authenticated user performing cancellation.
   * @returns Updated Request with status CANCELLED.
   */
  static async cancelRequest(id: string, reason: string | undefined, actor: AuthUser): Promise<Request> {
    return WorkflowEngine.cancel(id, reason, actor);
  }

  /** Add a comment to a request */
  /**
   * Add a comment to a request and create an audit entry.
   * @param requestId Request identifier.
   * @param comment   Text of the comment.
   * @param actor     Authenticated user adding the comment.
   */
  static async addComment(requestId: string, comment: string, actor: AuthUser) {
    const request = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    // Any participant can comment; no extra check needed beyond auth
    await prisma.approvalAction.create({
      data: {
        requestId,
        stepId: request.currentStepId ?? '',
        actorId: actor.id,
        action: ApprovalActionType.COMMENTED,
        comment,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        requestId,
        action: 'COMMENTED',
        description: `Comment added by ${actor.firstName}`,
      },
    });
    return { success: true };
  }

  /** Upload a document (URL) */
  /**
   * Upload a document URL for a request and log audit.
   * @param requestId Request identifier.
   * @param fileName  Name of the uploaded file.
   * @param url       URL where the document is stored.
   * @param actor     Authenticated user uploading the document.
   */
  static async uploadDocument(requestId: string, fileName: string, url: string, actor: AuthUser) {
    // For simplicity store in a generic Document table (assumed to exist)
    await prisma.attachment.create({
      data: { 
        requestId, 
        originalName: fileName, 
        storagePath: url, 
        mimeType: 'application/octet-stream', // Default
        sizeBytes: 0, // Default
        uploadedById: actor.id 
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        requestId,
        action: 'DOCUMENT_UPLOADED',
        description: `Document "${fileName}" uploaded by ${actor.firstName}`,
      },
    });
    return { success: true };
  }

  /** Retrieve a request by id */
  /**
   * Retrieve a request by ID after performing authorization checks.
   * @param id    Request identifier.
   * @param actor Authenticated user requesting the data.
   * @returns Full Request record with related workflow data.
   */
  static async getRequestById(id: string, actor: AuthUser) {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id },
      include: { 
        workflowTemplate: {
          include: {
            steps: {
              orderBy: { order: 'asc' }
            }
          }
        }, 
        currentStep: true,
        auditLogs: { orderBy: { timestamp: 'asc' } },
        purchaseDetail: true,
        leaveDetail: true,
        maintenanceDetail: true,
        department: true,
      },
    });

    // Enrich audit logs with actor information
    const actorIds = [...new Set(request.auditLogs.map((l: any) => l.actorId).filter(Boolean))];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds as string[] } },
      select: { id: true, firstName: true, lastName: true, role: true }
    });
    const actorMap = Object.fromEntries(actors.map((a: any) => [a.id, a]));

    const enrichedAuditLogs = request.auditLogs.map((log: any) => ({
      ...log,
      actor: log.actorId ? actorMap[log.actorId] : null
    }));

    const enrichedRequest = { ...request, auditLogs: enrichedAuditLogs };

    // Authorization – requester, approvers, or admin can view
    if (
      request.requestedById !== actor.id &&
      actor.role !== UserRole.ADMIN &&
      !(await WorkflowEngine.canUserActOnRequest(id, actor.id))
    ) {
      throw new AppError('You are not allowed to view this request.', 403);
    }
    return enrichedRequest;
  }

  /** List requests visible to the user */
  /**
   * List all requests visible to the authenticated user.
   * @param actor Authenticated user.
   * @returns Array of Request records.
   */
  static async listRequests(
    actor: AuthUser, 
    filters?: { search?: string; status?: string; type?: string; page?: number; limit?: number }
  ) {
    let rawRequests;
    
    if (actor.role === UserRole.ADMIN) {
      rawRequests = await prisma.request.findMany({ include: { workflowTemplate: true } });
    } else {
      // Fetch own requests and actionable requests in two efficient queries (C-08/C-09).
      // For the "actionable" query we filter at the DB level using the actor's role and
      // department — no per-request canUserActOnRequest loop needed.
      const [own, actionable] = await Promise.all([
        prisma.request.findMany({
          where: { requestedById: actor.id },
          include: { workflowTemplate: true },
        }),
        prisma.request.findMany({
          where: {
            status: RequestStatus.IN_REVIEW,
            currentStep: {
              approverRole: actor.role,
            },
            // For HOD, additionally filter by department at the request level
            ...(actor.role === UserRole.HOD ? { departmentId: actor.departmentId } : {}),
          },
          include: { workflowTemplate: true },
        }),
      ]);

      // Merge and deduplicate by id (a user may own a request that is also actionable)
      const seen = new Map<string, (typeof own)[number]>();
      for (const r of [...own, ...actionable]) {
        seen.set(r.id, r);
      }
      rawRequests = Array.from(seen.values());
    }

    // Apply in-memory filtering
    let results = rawRequests;

    if (filters) {
      if (filters.status) {
        results = results.filter(r => r.status === filters.status);
      }
      if (filters.type) {
        results = results.filter(r => r.type === filters.type);
      }
      if (filters.search) {
        const query = filters.search.toLowerCase();
        results = results.filter(r => 
          (r.referenceNumber && r.referenceNumber.toLowerCase().includes(query)) ||
          (r.title && r.title.toLowerCase().includes(query))
        );
      }
      
      // Default sorting to newest first
      results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply Pagination
      if (filters.page && filters.limit) {
        const startIndex = (filters.page - 1) * filters.limit;
        const endIndex = startIndex + filters.limit;
        results = results.slice(startIndex, endIndex);
      }
    } else {
      // Always sort newest first if no filters are provided
      results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return results;
  }

  /** Approve current step */
  /**
   * Approve the current step of a request via WorkflowEngine.
   * @param id      Request ID.
   * @param comment Optional approval comment.
   * @param actor   Authenticated user performing approval.
   * @returns Updated Request after approval.
   */
  static async approve(id: string, comment: string | undefined, actor: AuthUser) {
    return WorkflowEngine.approve(id, comment, actor);
  }

  /** Reject current step */
  /**
   * Reject the current step of a request via WorkflowEngine.
   * @param id      Request ID.
   * @param comment Optional rejection comment.
   * @param actor   Authenticated user performing rejection.
   * @returns Updated Request after rejection.
   */
  static async reject(id: string, comment: string | undefined, actor: AuthUser) {
    return WorkflowEngine.reject(id, comment, actor);
  }

  /** Return request to requester for correction */
  /**
   * Return a request to the requester for correction via WorkflowEngine.
   * @param id      Request ID.
   * @param comment Optional comment explaining the return.
   * @param actor   Authenticated user performing the return.
   * @returns Updated Request after return.
   */
  static async returnForCorrection(id: string, comment: string | undefined, actor: AuthUser) {
    return WorkflowEngine.returnForCorrection(id, comment, actor);
  }

  /** Retrieve comments for a request */
  /**
   * Retrieve all comment actions for a request after authorization.
   * @param requestId Request identifier.
   * @param actor    Authenticated user requesting comments.
   * @returns Array of comment records.
   */
  static async getComments(requestId: string, actor: AuthUser) {
    // Ensure the user can view the request
    await this.getRequestById(requestId, actor);
    const actions = await prisma.approvalAction.findMany({
      where: { requestId, action: ApprovalActionType.COMMENTED },
      select: { id: true, comment: true, actorId: true, takenAt: true },
    });
    return actions.map(a => ({
      id: a.id,
      comment: a.comment,
      actorId: a.actorId,
      createdAt: a.takenAt,
    }));
  }

  /** Retrieve documents for a request */
  /**
   * Retrieve all document records for a request after authorization.
   * @param requestId Request identifier.
   * @param actor    Authenticated user requesting documents.
   * @returns Array of document records.
   */
  static async getDocuments(requestId: string, actor: AuthUser) {
    // Authorization check
    await this.getRequestById(requestId, actor);
    const attachments = await prisma.attachment.findMany({
      where: { requestId },
      select: { id: true, originalName: true, storagePath: true, uploadedById: true, createdAt: true },
    });
    return attachments.map(a => ({
      id: a.id,
      fileName: a.originalName,
      url: a.storagePath,
      uploadedById: a.uploadedById,
      createdAt: a.createdAt,
    }));
  }

  /**
   * Return an analytics summary for the user's visible requests.
   */
  static async getAnalytics(actor: AuthUser) {
    const requests = await this.listRequests(actor);

    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let returned = 0;

    const typeDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    for (const r of requests) {
      total++;
      if (r.status === RequestStatus.IN_REVIEW) pending++;
      if (r.status === RequestStatus.APPROVED) approved++;
      if (r.status === RequestStatus.REJECTED) rejected++;
      if (r.status === RequestStatus.RETURNED) returned++;

      typeDistribution[r.type] = (typeDistribution[r.type] || 0) + 1;
      statusDistribution[r.status] = (statusDistribution[r.status] || 0) + 1;
    }

    // Recent activity (e.g., top 5 most recent requests)
    const recentActivity = [...requests]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      kpis: {
        total,
        pending,
        approved,
        rejected,
        returned,
      },
      distribution: {
        type: Object.entries(typeDistribution).map(([name, value]) => ({ name, value })),
        status: Object.entries(statusDistribution).map(([name, value]) => ({ name, value })),
      },
      recentActivity,
    };
  }
}
