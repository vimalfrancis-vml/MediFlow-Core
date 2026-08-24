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
    actor: AuthUser
  ): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: { currentStep: true },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      throw new AppError('This request is not under review right now.', 400);
    }

    // Verify actor is authorized for current step
    await this.verifyApproverPermission(request, actor);

    // Resolve next step BEFORE the transaction (may perform DB reads/writes for dynamic templates)
    const nextStep = await StepResolver.getNextStep(request.id, request.currentStep.id);

    const isFinalStep = request.currentStep.isFinal || !nextStep;

    // Atomic transaction: approval action + state change + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Record approval action
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          stepId: request.currentStep!.id,
          actorId: actor.id,
          action: ApprovalActionType.APPROVED,
          comment,
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

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            requestId: request.id,
            action: 'APPROVED',
            description: `Final approval completed by ${actor.firstName} ${actor.lastName}`,
          },
        });
      } else {
        // Advance to next step
        updated = await tx.request.update({
          where: { id: requestId },
          data: {
            currentStepId: nextStep!.id,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            requestId: request.id,
            action: 'STEP_APPROVED',
            description: `Approved by ${actor.firstName} ${actor.lastName} (${request.currentStep!.stepName})`,
          },
        });
      }

      return updated;
    });

    // Notify next approvers AFTER commit using the freshly updated request (C-03)
    // Wrapped in try/catch so a notification failure does NOT surface as a workflow error
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
    actor: AuthUser
  ): Promise<Request> {
    const request = await prisma.request.findUniqueOrThrow({
      where: { id: requestId },
      include: { currentStep: true },
    });

    if (request.status !== RequestStatus.IN_REVIEW || !request.currentStep) {
      throw new AppError('This request is not under review right now.', 400);
    }

    if (!comment) {
      throw new AppError('Please provide a reason for rejecting the request.', 400);
    }

    // Verify permission
    await this.verifyApproverPermission(request, actor);

    // Atomic transaction: rejection action + state change + notification + audit log (C-01)
    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          stepId: request.currentStep!.id,
          actorId: actor.id,
          action: ApprovalActionType.REJECTED,
          comment,
        },
      });

      const updated = await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          currentStepId: null,
        },
      });

      await tx.notification.create({
        data: {
          recipientId: request.requestedById,
          requestId: request.id,
          message: `Your request "${request.title}" has been rejected. Reason: ${comment}`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId: request.id,
          action: 'REJECTED',
          description: `Rejected by ${actor.firstName} ${actor.lastName}. Reason: ${comment}`,
        },
      });

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
   * Returns whether a user is authorized to perform approval actions on a request.
   * Note: Delegation support is not implemented in this version (no UserDelegation model).
   * This is tracked as an architectural enhancement for Phase 4.
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
    });

    if (!user) {
      return false;
    }

    // Role check
    if (user.role !== request.currentStep.approverRole) {
      return false;
    }

    // Department check for HOD
    if (user.role === UserRole.HOD && user.departmentId !== request.departmentId) {
      return false;
    }

    return true;
  }

  /**
   * Helper to verify if the actor matches permissions for the request's current step.
   * Note: Delegation support is not implemented in this version (no UserDelegation model).
   * This is tracked as an architectural enhancement for Phase 4.
   */
  private static async verifyApproverPermission(
    request: Request & { currentStep: { approverRole: UserRole } | null },
    actor: AuthUser
  ): Promise<void> {
    if (!request.currentStep) {
      throw new AppError('No active workflow step found.', 400);
    }

    // Self-approval hard check: A requester cannot approve their own request
    if (actor.id === request.requestedById) {
      throw new AppError('You cannot approve your own request.', 403);
    }

    if (actor.role !== request.currentStep.approverRole) {
      throw new AppError('You cannot take action on this step.', 403);
    }

    if (actor.role === UserRole.HOD && actor.departmentId !== request.departmentId) {
      throw new AppError('You can only approve requests from your own department.', 403);
    }
  }

  /**
   * Helper to notify all eligible approvers for a workflow step.
   * Accepts the already-committed (updated) request to ensure notifications
   * contain accurate, up-to-date data (C-03).
   * Runs OUTSIDE any transaction — notifications are best-effort and should not
   * roll back a successful state change if the notification write fails.
   */
  private static async notifyApprovers(
    request: Request,
    step: { approverRole: UserRole; stepName: string }
  ): Promise<void> {
    const approvers = await prisma.user.findMany({
      where: {
        role: step.approverRole,
        isActive: true,
        ...(step.approverRole === UserRole.HOD ? { departmentId: request.departmentId } : {}),
      },
    });

    const typeLabel = request.type.toLowerCase();
    const notificationMessage = `A new ${typeLabel} request "${request.title}" needs your review for step "${step.stepName}".`;

    // Use createMany for a single round-trip instead of N individual creates (C-10)
    await prisma.notification.createMany({
      data: approvers.map((approver) => ({
        recipientId: approver.id,
        requestId: request.id,
        message: notificationMessage,
      })),
      skipDuplicates: true,
    });
  }
}
