// src/request/request.service.ts

import { WorkflowEngine } from '../core/WorkflowEngine';
import { resolveActiveWorkflowTemplate } from '../core/StepResolver';
import { prisma } from '../db';
import { Request, RequestStatus, ApprovalActionType, UserRole, RequestType } from '@prisma/client';
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
    
    // Resolve workflowTemplateId: use provided or fallback to authoritative active template
    const template = await resolveActiveWorkflowTemplate(cleanData.type, workflowTemplateId);
    const templateId = template.id;
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

        // Validate that startDate is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(details.startDate);
        const checkStartDate = (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3])
          ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
          : new Date(startDate);
        checkStartDate.setHours(0, 0, 0, 0);
        if (checkStartDate < today) {
            throw new AppError('Leave start date cannot be in the past.', 400);
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
    } else if (cleanData.type === 'GENERAL') {
        if (!details) {
            throw new AppError('Details are required for General requests.', 400);
        }
        const description = (details.description || details.requirement || '').trim();
        if (!description) {
            throw new AppError('Description / requirement is required.', 400);
        }
        if (!details.targetDepartmentId && !details.targetUserId) {
            throw new AppError('Please select a target department or specific recipient.', 400);
        }

        let targetUserId = details.targetUserId ? details.targetUserId.trim() : null;
        let targetDeptId = details.targetDepartmentId ? details.targetDepartmentId.trim() : null;

        if (targetUserId) {
            if (targetUserId === actor.id) {
                throw new AppError('Requester cannot assign a General Request to themselves.', 400);
            }
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId, isActive: true },
                include: { department: true },
            });
            if (!targetUser) {
                throw new AppError('Target recipient not found or is inactive.', 404);
            }
            if (targetUser.role === UserRole.ADMIN) {
                throw new AppError('Cannot assign request to an Administrator.', 400);
            }
            if (!targetDeptId) {
                targetDeptId = targetUser.departmentId;
            }
            requestData.assignedToUser = { connect: { id: targetUser.id } };
        }

        if (targetDeptId) {
            const targetDept = await prisma.department.findUnique({
                where: { id: targetDeptId, isActive: true },
            });
            if (!targetDept) {
                throw new AppError('Target department not found or is inactive.', 404);
            }
        }

        let requiredDate: Date | null = null;
        let endDate: Date | null = null;

        if (details.requiredDate) {
            requiredDate = new Date(details.requiredDate);
            if (isNaN(requiredDate.getTime())) {
                throw new AppError('Invalid required date format.', 400);
            }
        }

        if (details.endDate) {
            endDate = new Date(details.endDate);
            if (isNaN(endDate.getTime())) {
                throw new AppError('Invalid end date format.', 400);
            }
        }

        if (requiredDate && endDate && endDate < requiredDate) {
            throw new AppError('End date cannot be before the required date.', 400);
        }

        const subject = (details.subject || cleanData.title || 'General Request').trim();

        requestData.generalDetail = {
            create: {
                subject,
                description,
                targetDepartmentId: targetDeptId,
                targetUserId,
                requiredDate,
                endDate,
            },
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

        if (details.startDate !== undefined) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(details.startDate));
          const checkStartDate = (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3])
            ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
            : new Date(startDate);
          checkStartDate.setHours(0, 0, 0, 0);
          if (checkStartDate < today) {
            throw new AppError('Leave start date cannot be in the past.', 400);
          }
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
      } else if (request.type === 'GENERAL') {
        const updateDetailData: any = {};
        if (details.subject !== undefined) updateDetailData.subject = details.subject.trim();
        if (details.description !== undefined) {
          if (!details.description.trim()) {
            throw new AppError('Description / requirement is required.', 400);
          }
          updateDetailData.description = details.description.trim();
        }
        if (details.targetUserId !== undefined) {
          if (details.targetUserId) {
            if (details.targetUserId === actor.id) {
              throw new AppError('Requester cannot assign a General Request to themselves.', 400);
            }
            const targetUser = await prisma.user.findUnique({
              where: { id: details.targetUserId, isActive: true },
            });
            if (!targetUser) throw new AppError('Target recipient not found or is inactive.', 404);
            if (targetUser.role === UserRole.ADMIN) throw new AppError('Cannot assign request to an Administrator.', 400);
            updateDetailData.targetUserId = targetUser.id;
            updateData.assignedToUserId = targetUser.id;
          } else {
            updateDetailData.targetUserId = null;
            updateData.assignedToUserId = null;
          }
        }
        if (details.targetDepartmentId !== undefined) {
          if (details.targetDepartmentId) {
            const targetDept = await prisma.department.findUnique({
              where: { id: details.targetDepartmentId, isActive: true },
            });
            if (!targetDept) throw new AppError('Target department not found or is inactive.', 404);
            updateDetailData.targetDepartmentId = targetDept.id;
          } else {
            updateDetailData.targetDepartmentId = null;
          }
        }
        if (details.requiredDate !== undefined) {
          updateDetailData.requiredDate = details.requiredDate ? new Date(details.requiredDate) : null;
        }
        if (details.endDate !== undefined) {
          updateDetailData.endDate = details.endDate ? new Date(details.endDate) : null;
        }
        updateData.generalDetail = {
          update: updateDetailData,
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
  static async addComment(requestId: string, comment: string, actor: AuthUser) {
    // 1. Authorize: Ensure actor has access to view this request
    const request = await this.getRequestById(requestId, actor);
    
    if (!comment || !comment.trim()) {
      throw new AppError('Comment cannot be empty.', 400);
    }

    const cleanComment = comment.trim();

    await prisma.$transaction(async (tx) => {
      await tx.approvalAction.create({
        data: {
          requestId,
          stepId: request.currentStepId ?? '',
          actorId: actor.id,
          action: ApprovalActionType.COMMENTED,
          comment: cleanComment,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId,
          action: 'COMMENTED',
          description: `Comment added by ${actor.firstName} ${actor.lastName}`,
        },
      });
    });

    return { success: true };
  }

  /** Upload a document (URL) */
  static async uploadDocument(requestId: string, fileName: string, url: string, actor: AuthUser) {
    // 1. Authorize: Ensure actor has access to view this request
    const request = await this.getRequestById(requestId, actor);

    // 2. State check: Cannot upload documents to cancelled or rejected requests
    if (request.status === RequestStatus.CANCELLED || request.status === RequestStatus.REJECTED) {
      throw new AppError('Cannot upload documents to a cancelled or rejected request.', 400);
    }

    // 3. Clean and sanitize filename against path traversal
    const cleanFileName = fileName.replace(/[\\/\0]|(\.\.)/g, '').trim();
    if (!cleanFileName) {
      throw new AppError('Invalid file name.', 400);
    }

    // 4. Scheme check: only http, https, or relative internal path starting with /
    const trimmedUrl = url.trim();
    if (/^(javascript|data|vbscript|file):/i.test(trimmedUrl)) {
      throw new AppError('Dangerous URL schemes are strictly prohibited.', 400);
    }
    if (!/^https?:\/\//i.test(trimmedUrl) && !/^\/[a-zA-Z0-9_\-./]+$/.test(trimmedUrl)) {
      throw new AppError('Document URL must be a valid HTTP/HTTPS URL or secure storage path.', 400);
    }

    // Infer MIME type
    const ext = cleanFileName.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      csv: 'text/csv',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';

    // 5. Atomic transaction: create Attachment + AuditLog
    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          requestId,
          originalName: cleanFileName,
          storagePath: trimmedUrl,
          mimeType,
          sizeBytes: 0, // Architecture note: URLs/metadata stored, file bytes handled by storage backend
          uploadedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId,
          action: 'DOCUMENT_UPLOADED',
          description: `Document "${cleanFileName}" uploaded by ${actor.firstName} ${actor.lastName}`,
        },
      });

      return created;
    });

    return { success: true, data: attachment };
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
        attachments: { orderBy: { createdAt: 'desc' } },
        purchaseDetail: true,
        leaveDetail: true,
        maintenanceDetail: true,
        generalDetail: {
          include: {
            targetDepartment: true,
            targetUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                roleRef: { select: { displayName: true } },
                department: { select: { id: true, name: true, code: true, displayName: true } },
              },
            },
          },
        },
        department: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            roleRef: { select: { displayName: true } },
            department: { select: { id: true, name: true, code: true, displayName: true } },
          },
        },
        assignedToUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            roleRef: { select: { displayName: true } },
            department: { select: { id: true, name: true, code: true, displayName: true } },
          },
        },
      },
    });

    // Enrich audit logs & attachments with user information
    const userIds = [
      ...new Set([
        ...request.auditLogs.map((l: any) => l.actorId),
        ...((request as any).attachments || []).map((a: any) => a.uploadedById),
      ].filter(Boolean)),
    ];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds as string[] } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true }
    });
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

    const enrichedAuditLogs = request.auditLogs.map((log: any) => ({
      ...log,
      actor: log.actorId ? userMap[log.actorId] : null
    }));

    const enrichedAttachments = ((request as any).attachments || []).map((att: any) => ({
      ...att,
      uploadedBy: att.uploadedById ? userMap[att.uploadedById] : null
    }));

    const enrichedRequest = {
      ...request,
      auditLogs: enrichedAuditLogs,
      attachments: enrichedAttachments
    };

    // Authorization – requester, admins, current/past approvers, or anyone in the workflow steps can view
    const isInWorkflow = request.workflowTemplate?.steps.some(
      (step: any) => step.approverRole === actor.role
    ) ?? false;

    // Check if they have taken any approval actions on this request in the past
    const hasParticipated = await prisma.approvalAction.findFirst({
      where: {
        requestId: id,
        actorId: actor.id,
      },
    }) !== null;

    // HODs are restricted to requests in their department
    const isHodAuthorized = actor.role !== UserRole.HOD || actor.departmentId === request.departmentId;
    const canAct = await WorkflowEngine.canUserActOnRequest(id, actor.id);

    const isGeneralTargetAuthorized = request.type === 'GENERAL' && (
      (request.generalDetail?.targetDepartmentId && actor.departmentId === request.generalDetail.targetDepartmentId) ||
      request.assignedToUserId === actor.id
    );

    if (
      request.requestedById !== actor.id &&
      actor.role !== UserRole.ADMIN &&
      !canAct &&
      !hasParticipated &&
      !isGeneralTargetAuthorized &&
      !(isInWorkflow && isHodAuthorized)
    ) {
      throw new AppError('You are not allowed to view this request.', 403);
    }
    return { ...enrichedRequest, canAct };
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
    const requestInclude = {
      workflowTemplate: true,
      department: true,
      currentStep: true,
      purchaseDetail: true,
      leaveDetail: true,
      maintenanceDetail: true,
      generalDetail: {
        include: {
          targetDepartment: true,
          targetUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              roleRef: { select: { displayName: true } },
              department: { select: { id: true, name: true, code: true, displayName: true } },
            },
          },
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          roleRef: { select: { displayName: true } },
          department: { select: { id: true, name: true, code: true, displayName: true } },
        },
      },
      assignedToUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          roleRef: { select: { displayName: true } },
          department: { select: { id: true, name: true, code: true, displayName: true } },
        },
      },
    };

    let rawRequests;
    
    if (actor.role === UserRole.ADMIN) {
      rawRequests = await prisma.request.findMany({ include: requestInclude });
    } else {
      // Fetch own requests, actionable requests, and previously-actioned requests:
      //   - own: requests the user submitted
      //   - assignedToMe: requests currently waiting for this user via direct forward/assignment
      //   - unassignedActionable: requests in review with no specific assignee, matching actor's role & dept, or general department queue
      //   - participated: requests this user has already actioned (APPROVED, REJECTED, RETURNED, FORWARDED)
      const [own, assignedToMe, unassignedActionable, participated] = await Promise.all([
        prisma.request.findMany({
          where: { requestedById: actor.id },
          include: requestInclude,
        }),
        prisma.request.findMany({
          where: {
            status: RequestStatus.IN_REVIEW,
            assignedToUserId: actor.id,
          },
          include: requestInclude,
        }),
        prisma.request.findMany({
          where: {
            status: RequestStatus.IN_REVIEW,
            assignedToUserId: null,
            OR: [
              {
                type: { not: RequestType.GENERAL },
                currentStep: {
                  approverRole: actor.role,
                },
                // For HOD, additionally filter by department at the request level
                ...(actor.role === UserRole.HOD ? { departmentId: actor.departmentId } : {}),
                // For Finance, filter by department code FIN
                ...(actor.role === UserRole.FINANCE_OFFICER ? { department: { code: 'FIN' } } : {}),
              },
              {
                type: RequestType.GENERAL,
                generalDetail: {
                  targetDepartmentId: actor.departmentId,
                },
              },
            ],
          },
          include: requestInclude,
        }),
        // Fetch requests where this user has taken at least one approval action
        prisma.request.findMany({
          where: {
            approvalActions: {
              some: {
                actorId: actor.id,
                action: {
                  in: [
                    ApprovalActionType.APPROVED,
                    ApprovalActionType.REJECTED,
                    ApprovalActionType.RETURNED,
                    ApprovalActionType.FORWARDED,
                  ],
                },
              },
            },
          },
          include: requestInclude,
        }),
      ]);

      // Merge and deduplicate by id
      const seen = new Map<string, (typeof own)[number]>();
      for (const r of [...own, ...assignedToMe, ...unassignedActionable, ...participated]) {
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

  static async approve(
    id: string,
    comment: string | undefined,
    actor: AuthUser,
    options?: { isOverride?: boolean; overrideReason?: string }
  ) {
    return WorkflowEngine.approve(id, comment, actor, options);
  }

  /** Reject current step */
  /**
   * Reject the current step of a request via WorkflowEngine.
   * @param id      Request ID.
   * @param comment Optional rejection comment.
   * @param actor   Authenticated user performing rejection.
   * @param options Optional administrative override parameters.
   * @returns Updated Request after rejection.
   */
  static async reject(
    id: string,
    comment: string | undefined,
    actor: AuthUser,
    options?: { isOverride?: boolean; overrideReason?: string }
  ) {
    return WorkflowEngine.reject(id, comment, actor, options);
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

  /** Forward request to another eligible recipient */
  static async forward(id: string, targetUserId: string, comment: string | undefined, actor: AuthUser) {
    return WorkflowEngine.forward(id, targetUserId, comment, actor);
  }

  /** Get eligible forwarding recipients for the current step */
  static async getEligibleRecipients(id: string, actor: AuthUser) {
    return WorkflowEngine.getEligibleRecipients(id, actor);
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

  /**
   * Return recipient directory of active departments and active authorized personnel.
   */
  static async getRecipientDirectory(actor: AuthUser) {
    const [departments, users] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          displayName: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          role: { not: UserRole.ADMIN },
          id: { not: actor.id },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              displayName: true,
            },
          },
          roleRef: {
            select: {
              displayName: true,
            },
          },
        },
        orderBy: [
          { department: { name: 'asc' } },
          { firstName: 'asc' },
        ],
      }),
    ]);
    return { departments, users };
  }
}
