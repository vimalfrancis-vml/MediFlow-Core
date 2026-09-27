import { prisma } from '../db';
import { Request, RequestStatus, ApprovalActionType, UserRole } from '@prisma/client';
import { StepResolver } from './StepResolver';
import { AppError } from '../middleware/errorHandler';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentCode: string;
  firstName: string;
  lastName: string;
}

// Core engine orchestrating request workflow with clear, single responsibilities.
// All state-changing methods use a single Prisma transaction so that the DB write,
// audit log entry, and notification are committed atomically (C-01).
export class WorkflowEngine {
  /**
   * Submits a request, transitioning it from DRAFT or RETURNED to IN_REVIEW.
   * Resolves the initial step and notifies the first approvers.
   */
  public static async submitRequest(requestId: string, actor: AuthUser): Promise<Request> {
    // Resolve steps BEFORE the transaction (read-only, may create a dynamic template clone)
    const steps = await StepResolver.getStepsForRequest(requestId);
    const firstStep = steps[0];

    if (!firstStep) {
      throw new AppError('No workflow steps are configured for this request type.', 500);
    }

    // Fetch to validate current state
    const existing = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
    });

    if (
      existing.status !== RequestStatus.DRAFT &&
      existing.status !== RequestStatus.RETURNED
    ) {
      throw new AppError('Only draft or returned requests can be submitted.', 400);
    }

    if (existing.requestedById !== actor.id) {
      throw new AppError('You are not allowed to submit this request.', 403);
    }

    // Atomic transaction: update status + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.IN_REVIEW,
          currentStepId: firstStep.id,
          assignedToUserId: null,
          submittedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId: requestId,
          action: 'SUBMITTED',
          description: `Submitted for approval by ${actor.firstName} ${actor.lastName}`,
        },
      });

      return updated;
    });

    // Notify approvers AFTER commit (outside transaction — notifications are best-effort)
    // Wrapped in try/catch so a notification failure does NOT surface as a workflow error
    try {
      await this.notifyApprovers(updatedRequest, firstStep);
    } catch (notifErr) {
      console.error('[WARN] Failed to send approver notifications after submit:', notifErr);
    }

    return updatedRequest;
  }

  /**
   * Approves the current step. If it's the final step, marks the request APPROVED.
   * Otherwise, advances the request to the next step.
   */
  public static async approve(
    requestId: string,
    comment: string | undefined,
    actor: AuthUser,
    options?: { isOverride?: boolean; overrideReason?: string }
  ): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: { currentStep: true },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      throw new AppError('This request is not under review right now.', 400);
    }

    // Verify actor is authorized for current step (respecting explicit override checks)
    await this.verifyApproverPermission(request, actor, options);

    // Resolve next step BEFORE the transaction (may perform DB reads/writes for dynamic templates)
    const nextStep = await StepResolver.getNextStep(request.id, request.currentStep.id);

    const isFinalStep = request.currentStep.isFinal || !nextStep;

    const approvalComment = options?.isOverride
      ? `[ADMIN OVERRIDE: ${options.overrideReason!.trim()}]${comment ? ` ${comment.trim()}` : ''}`
      : comment;

    // Atomic transaction: approval action + state change + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Record approval action
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          stepId: request.currentStep!.id,
          actorId: actor.id,
          action: ApprovalActionType.APPROVED,
          comment: approvalComment,
        },
      });

      let updated: Request;

      if (isFinalStep) {
        // Final approval — mark request as APPROVED
        updated = await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.APPROVED,
            currentStepId: null,
            assignedToUserId: null,
            completedAt: new Date(),
          },
        });

        // Notify requester of approval
        await tx.notification.create({
          data: {
            recipientId: request.requestedById,
            requestId: request.id,
            message: `Your request "${request.title}" has been approved.`,
          },
        });

        if (options?.isOverride) {
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              requestId: request.id,
              action: 'ADMIN_OVERRIDE_FINAL_APPROVAL',
              description: `Administrative override executed by Admin ${actor.firstName} ${actor.lastName} for step "${request.currentStep!.stepName}": ${options.overrideReason!.trim()}`,
            },
          });
        } else {
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              requestId: request.id,
              action: 'APPROVED',
              description: `Final approval completed by ${actor.firstName} ${actor.lastName}`,
            },
          });
        }
      } else {
        // Advance to next step (resetting assigned recipient for new stage)
        updated = await tx.request.update({
          where: { id: requestId },
          data: {
            currentStepId: nextStep!.id,
            assignedToUserId: null,
          },
        });

        if (options?.isOverride) {
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              requestId: request.id,
              action: 'ADMIN_OVERRIDE_STEP_APPROVAL',
              description: `Administrative override executed by Admin ${actor.firstName} ${actor.lastName} for step "${request.currentStep!.stepName}": ${options.overrideReason!.trim()}`,
            },
          });
        } else {
          await tx.auditLog.create({
            data: {
              actorId: actor.id,
              requestId: request.id,
              action: 'STEP_APPROVED',
              description: `Approved by ${actor.firstName} ${actor.lastName} (${request.currentStep!.stepName})`,
            },
          });
        }
      }

      return updated;
    });

    // Notify next approvers AFTER commit using the freshly updated request (C-03)
    if (!isFinalStep && nextStep) {
      try {
        await this.notifyApprovers(updatedRequest, nextStep);
      } catch (notifErr) {
        console.error('[WARN] Failed to send approver notifications after approve:', notifErr);
      }
    }

    return updatedRequest;
  }

  /**
   * Rejects the request, stopping the workflow.
   */
  public static async reject(
    requestId: string,
    comment: string | undefined,
    actor: AuthUser,
    options?: { isOverride?: boolean; overrideReason?: string }
  ): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: { currentStep: true },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      throw new AppError('This request is not under review right now.', 400);
    }

    if (!comment && !options?.overrideReason) {
      throw new AppError('Please provide a reason for rejecting the request.', 400);
    }

    // Verify permission (respecting explicit override)
    await this.verifyApproverPermission(request, actor, options);

    const effectiveReason = options?.isOverride ? options.overrideReason!.trim() : comment!.trim();

    // Atomic transaction: rejection action + state change + notification + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const rejectionComment = options?.isOverride
        ? `[ADMIN OVERRIDE: ${options.overrideReason!.trim()}]${comment ? ` ${comment.trim()}` : ''}`
        : comment;

      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          stepId: request.currentStep!.id,
          actorId: actor.id,
          action: ApprovalActionType.REJECTED,
          comment: rejectionComment,
        },
      });

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          currentStepId: null,
          assignedToUserId: null,
          completedAt: new Date(),
        },
      });

      await tx.notification.create({
        data: {
          recipientId: request.requestedById,
          requestId: request.id,
          message: `Your request "${request.title}" has been rejected. Reason: ${effectiveReason}`,
        },
      });

      if (options?.isOverride) {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            requestId: request.id,
            action: 'ADMIN_OVERRIDE_REJECTION',
            description: `Administrative override rejection executed by Admin ${actor.firstName} ${actor.lastName}. Reason: ${options.overrideReason!.trim()}`,
          },
        });
      } else {
        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            requestId: request.id,
            action: 'REJECTED',
            description: `Rejected by ${actor.firstName} ${actor.lastName}. Reason: ${effectiveReason}`,
          },
        });
      }

      return updated;
    });

    return updatedRequest;
  }

  /**
   * Returns the request to the requester for correction (Needs Changes).
   */
  public static async returnForCorrection(
    requestId: string,
    comment: string | undefined,
    actor: AuthUser
  ): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: { currentStep: true },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      throw new AppError('This request is not currently under review.', 400);
    }

    if (!comment) {
      throw new AppError('Please clarify what changes are needed.', 400);
    }

    // Verify permission
    await this.verifyApproverPermission(request, actor);

    // Atomic transaction: return action + state change + notification + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          stepId: request.currentStep!.id,
          actorId: actor.id,
          action: ApprovalActionType.RETURNED,
          comment,
        },
      });

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.RETURNED,
          currentStepId: null,
          assignedToUserId: null,
        },
      });

      await tx.notification.create({
        data: {
          recipientId: request.requestedById,
          requestId: request.id,
          message: `Your request "${request.title}" needs changes. Note: ${comment}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId: request.id,
          action: 'RETURNED',
          description: `Returned for changes by ${actor.firstName} ${actor.lastName}. Details: ${comment}`,
        },
      });

      return updated;
    });

    return updatedRequest;
  }

  /**
   * Cancels the request (can be done by requester or admin).
   */
  public static async cancel(requestId: string, reason: string | undefined, actor: AuthUser): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
    });

    const cancellableStatuses: RequestStatus[] = [
      RequestStatus.DRAFT,
      RequestStatus.IN_REVIEW,
      RequestStatus.RETURNED,
    ];

    if (!cancellableStatuses.includes(request.status)) {
      throw new AppError('This request cannot be cancelled at this point.', 400);
    }

    // Only the requester or an admin can cancel
    if (request.requestedById !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new AppError('You are not permitted to cancel this request.', 403);
    }

    // Atomic transaction: cancel action + state change + notification + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Record cancellation action if the request was already in review
      if (request.currentStepId) {
        await tx.approvalAction.create({
          data: {
            requestId: request.id,
            stepId: request.currentStepId,
            actorId: actor.id,
            action: ApprovalActionType.CANCELLED,
            comment: reason,
          },
        });
      }

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.CANCELLED,
          currentStepId: null,
          assignedToUserId: null,
        },
      });

      await tx.notification.create({
        data: {
          recipientId: request.requestedById,
          requestId: request.id,
          message: `Your request "${request.title}" has been cancelled.${reason ? ' Reason: ' + reason : ''}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId: request.id,
          action: 'CANCELLED',
          description: `Cancelled by ${actor.firstName} ${actor.lastName}${reason ? `. Reason: ${reason}` : ''}`,
        },
      });

      return updated;
    });

    return updatedRequest;
  }

  /**
   * Forwards/reassigns the current step to a specific eligible recipient.
   * Semantics:
   * - Changes responsible recipient (`assignedToUserId`)
   * - The current workflow step REMAINS PENDING (does NOT approve, complete, or advance the step)
   * - Mandatory business rules & Finance-first invariants are strictly enforced
   * - Self-approval is strictly prohibited
   */
  public static async forward(
    requestId: string,
    targetUserId: string,
    comment: string | undefined,
    actor: AuthUser
  ): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        currentStep: {
          include: {
            approverDepartment: true,
          },
        },
        department: true,
      },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      throw new AppError('This request is not under review right now.', 400);
    }

    // Verify actor is authorized to act on or forward this step
    await this.verifyApproverPermission(request, actor);

    // 1. Prohibit self-forwarding or redundant reassignment
    if (targetUserId === actor.id) {
      throw new AppError('Cannot forward request to yourself.', 400);
    }
    if (targetUserId === request.assignedToUserId) {
      throw new AppError('Request is already assigned to this user.', 400);
    }

    // 2. Prohibit self-approval: cannot forward to the original requester
    if (targetUserId === request.requestedById) {
      throw new AppError('Cannot forward request to the original requester.', 400);
    }

    // 3. Fetch target user and validate active status
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId, isActive: true },
      include: { department: true },
    });

    if (!targetUser) {
      throw new AppError('Target recipient not found or is inactive.', 404);
    }

    // 4. Role and authorization validation:
    // A. Prohibit forwarding to Admin (Admins are not operational business approvers)
    if (targetUser.role === UserRole.ADMIN) {
      throw new AppError('Cannot forward request to an Administrator.', 400);
    }

    // B. Prohibit forwarding to employees who have no approver role
    const validApproverRoles = [
      UserRole.HOD,
      UserRole.PURCHASE_OFFICER,
      UserRole.MAINTENANCE_OFFICER,
      UserRole.DIRECTOR,
      UserRole.MEDICAL_SUPERINTENDENT,
      UserRole.FINANCE_OFFICER,
      UserRole.HR,
    ];
    if (!validApproverRoles.includes(targetUser.role as UserRole)) {
      throw new AppError('Target recipient must hold an authorized approver role.', 400);
    }

    // 5. Mandatory Business Rules & Invariants:
    // Finance-first invariant: If current step is Finance, target MUST be Finance Department personnel
    const isFinanceStep =
      request.currentStep.approverRole === UserRole.FINANCE_OFFICER ||
      request.currentStep.approverDepartment?.code === 'FIN';

    if (isFinanceStep) {
      if (targetUser.role !== UserRole.FINANCE_OFFICER) {
        throw new AppError('Target recipient must have role FINANCE_OFFICER.', 400);
      }
      if (targetUser.department.code !== 'FIN') {
        throw new AppError('Finance review can only be forwarded to Finance Department personnel.', 400);
      }
    }

    // Atomic transaction: record FORWARDED action + update assignedToUserId + log audit (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          stepId: request.currentStep!.id,
          actorId: actor.id,
          action: ApprovalActionType.FORWARDED,
          comment,
        },
      });

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          assignedToUserId: targetUser.id,
        },
      });

      await tx.notification.create({
        data: {
          recipientId: targetUser.id,
          requestId: request.id,
          message: `Request "${request.title}" was forwarded to you by ${actor.firstName} ${actor.lastName} for ${request.currentStep!.stepName}.`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId: request.id,
          action: 'FORWARDED',
          description: `Forwarded from ${request.currentStep!.stepName} to ${targetUser.firstName} ${targetUser.lastName} (${targetUser.role}${targetUser.department ? `, ${targetUser.department.name}` : ''}) by ${actor.firstName} ${actor.lastName}${comment ? `. Note: ${comment}` : ''}`,
        },
      });

      return updated;
    });

    return updatedRequest;
  }

  /**
   * Retrieves list of eligible users to whom the request can be forwarded at its current step.
   * Dynamic forwarding allows reassigning to authorized approvers across departments,
   * while strictly preserving Finance-first invariants for Finance steps and prohibiting self-approval.
   */
  public static async getEligibleRecipients(requestId: string, actor: AuthUser) {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        currentStep: {
          include: { approverDepartment: true },
        },
      },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      return [];
    }

    const isFinanceStep =
      request.currentStep.approverRole === UserRole.FINANCE_OFFICER ||
      request.currentStep.approverDepartment?.code === 'FIN';

    const whereClause: any = {
      isActive: true,
      role: isFinanceStep
        ? UserRole.FINANCE_OFFICER
        : {
            in: [
              UserRole.HOD,
              UserRole.PURCHASE_OFFICER,
              UserRole.MAINTENANCE_OFFICER,
              UserRole.DIRECTOR,
              UserRole.MEDICAL_SUPERINTENDENT,
              UserRole.FINANCE_OFFICER,
              UserRole.HR,
            ],
          },
      id: {
        notIn: [request.requestedById, actor.id, ...(request.assignedToUserId ? [request.assignedToUserId] : [])],
      },
    };

    if (isFinanceStep) {
      whereClause.department = { code: 'FIN' };
    }

    const eligible = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
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
    });

    return eligible;
  }

  /**
   * Returns whether a user is authorized to perform approval actions on a request.
   */
  public static async canUserActOnRequest(requestId: string, userId: string): Promise<boolean> {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { currentStep: true },
    });

    if (!request || request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      return false;
    }

    // Self-approval hard check: A requester cannot approve their own request
    if (userId === request.requestedById) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: { department: true },
    });

    if (!user) {
      return false;
    }

    // If request has been specifically forwarded/assigned to another user
    if (request.assignedToUserId) {
      return request.assignedToUserId === userId;
    }

    // Role check
    if (user.role !== request.currentStep.approverRole) {
      return false;
    }

    // Department check for HOD
    if (user.role === UserRole.HOD && user.departmentId !== request.departmentId) {
      return false;
    }

    // Finance department stable identity check (code 'FIN')
    if (request.currentStep.approverRole === UserRole.FINANCE_OFFICER && user.department?.code !== 'FIN') {
      return false;
    }

    if (request.currentStep.approverDepartmentId && user.departmentId !== request.currentStep.approverDepartmentId) {
      return false;
    }

    return true;
  }

  /**
   * Helper to verify if the actor matches permissions for the request's current step.
   */
  private static async verifyApproverPermission(
    request: Request & { currentStep: { approverRole: UserRole; approverDepartmentId?: string | null; stepName?: string } | null },
    actor: AuthUser,
    options?: { isOverride?: boolean; overrideReason?: string }
  ): Promise<void> {
    if (!request.currentStep) {
      throw new AppError('No active workflow step found.', 400);
    }

    // Self-approval hard check: A requester cannot approve their own request under any circumstances
    if (actor.id === request.requestedById) {
      throw new AppError('You cannot approve your own request.', 403);
    }

    if (options?.isOverride) {
      if (actor.role !== UserRole.ADMIN) {
        throw new AppError('Administrative override is restricted to administrators.', 403);
      }
      if (!options.overrideReason || !options.overrideReason.trim()) {
        throw new AppError('Administrative override requires an explicit justification reason.', 400);
      }

      // Explicitly protect Finance-first rule: Never bypass Finance review for requests > ₹1,00,000
      const reqWithDetails = await prisma.request.findUnique({
        where: { id: request.id },
        include: { purchaseDetail: true },
      });
      const cost = reqWithDetails?.purchaseDetail?.estimatedCost
        ? Number(reqWithDetails.purchaseDetail.estimatedCost)
        : 0;

      if (cost > 100000 && request.currentStep.approverRole === UserRole.FINANCE_OFFICER) {
        throw new AppError(
          'Administrative override cannot bypass mandatory Finance-first approval for high-value requests exceeding ₹1,00,000.',
          403
        );
      }

      // Valid administrative override
      return;
    }

    // If specifically assigned to another user, only that assigned user can act
    if (request.assignedToUserId) {
      if (request.assignedToUserId !== actor.id) {
        throw new AppError('This request has been specifically assigned to another reviewer.', 403);
      }
      return; // Actor is the assigned user, authorized to act on this forwarded request
    }

    if (actor.role !== request.currentStep.approverRole) {
      throw new AppError('You cannot take action on this step.', 403);
    }

    if (actor.role === UserRole.HOD && actor.departmentId !== request.departmentId) {
      throw new AppError('You can only approve requests from your own department.', 403);
    }

    if (request.currentStep.approverRole === UserRole.FINANCE_OFFICER && actor.departmentCode !== 'FIN') {
      throw new AppError('Only Finance department personnel can approve during Finance review.', 403);
    }

    if (request.currentStep.approverDepartmentId && actor.departmentId !== request.currentStep.approverDepartmentId) {
      throw new AppError('You do not belong to the required department for this approval step.', 403);
    }
  }

  /**
   * Helper to notify all eligible approvers for a workflow step.
   */
  private static async notifyApprovers(
    request: Request,
    step: { approverRole: UserRole; stepName: string; approverDepartmentId?: string | null }
  ): Promise<void> {
    let approverIds: string[] = [];

    if (request.assignedToUserId) {
      approverIds = [request.assignedToUserId];
    } else {
      const whereClause: any = {
        role: step.approverRole,
        isActive: true,
      };
      if (step.approverRole === UserRole.HOD) {
        whereClause.departmentId = request.departmentId;
      } else if (step.approverDepartmentId) {
        whereClause.departmentId = step.approverDepartmentId;
      } else if (step.approverRole === UserRole.FINANCE_OFFICER) {
        whereClause.department = { code: 'FIN' };
      }

      const approvers = await prisma.user.findMany({
        where: whereClause,
        select: { id: true },
      });
      approverIds = approvers.map((a) => a.id);
    }

    const typeLabel = request.type.toLowerCase();
    const notificationMessage = `A new ${typeLabel} request "${request.title}" needs your review for step "${step.stepName}".`;

    if (approverIds.length > 0) {
      await prisma.notification.createMany({
        data: approverIds.map((recipientId) => ({
          recipientId,
          requestId: request.id,
          message: notificationMessage,
        })),
        skipDuplicates: true,
      });
    }
  }
}
