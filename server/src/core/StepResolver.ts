// Resolves workflow steps, applying dynamic rules to generate request-specific step sequences
// Evaluates workflow rules to dynamically modify step sequences based on request context
import { prisma } from '../db';
import { WorkflowStep, Request, RequestType, Priority, UserRole } from '@prisma/client';
import { evaluateRules } from './RuleEvaluator';
import { RuleContext } from './workflow.rules';
import { AppError } from '../middleware/errorHandler';
import { assertActiveRequest } from '../utils/requestFilter';

/**
 * Authoritative resolver for active/effective base workflow templates.
 * Safeguards:
 * 1. Must match requestType.
 * 2. Must have isActive: true.
 * 3. Must have deletedAt: null (never deleted/archived).
 * 4. Never select dynamic cloned instances (starts with 'Dynamic:').
 * 5. Ordered by version: 'desc' to pick the latest effective active version.
 */
export async function resolveActiveWorkflowTemplate(requestType: RequestType, preferredTemplateId?: string) {
  if (preferredTemplateId) {
    const tmpl = await prisma.workflowTemplate.findFirst({
      where: {
        id: preferredTemplateId,
        requestType,
        isActive: true,
        deletedAt: null,
        NOT: { name: { startsWith: 'Dynamic:' } },
      },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });
    if (tmpl) return tmpl;
  }

  const activeTemplate = await prisma.workflowTemplate.findFirst({
    where: {
      requestType,
      isActive: true,
      deletedAt: null,
      NOT: { name: { startsWith: 'Dynamic:' } },
    },
    orderBy: {
      version: 'desc',
    },
    include: {
      steps: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!activeTemplate) {
    throw new AppError(`No active workflow template found for request type ${requestType}`, 400);
  }

  return activeTemplate;
}

export class StepResolver {
  private static inflightResolutions = new Map<string, Promise<WorkflowStep[]>>();

  /**
   * Resolves and returns the fully evaluated list of workflow steps for a request.
   * If the request is in DRAFT/SUBMITTED and rules alter the flow, it handles cloning
   * the template to store the request-specific dynamic steps.
   *
   * Concurrency & Invariant Safeguards:
   * 1. Coalesces in-flight resolution promises per requestId to prevent concurrent duplicate runs.
   * 2. Atomic Prisma interactive transaction ensures dynamic template creation, step deletion,
   *    request linkage, and step insertion never produce partial state on failure.
   * 3. Idempotent matching avoids recreating steps when existing dynamic steps are already valid.
   */
  public static async getStepsForRequest(requestId: string): Promise<WorkflowStep[]> {
    const existing = this.inflightResolutions.get(requestId);
    if (existing) {
      return existing;
    }

    const promise = this.resolveStepsInternal(requestId).finally(() => {
      this.inflightResolutions.delete(requestId);
    });

    this.inflightResolutions.set(requestId, promise);
    return promise;
  }

  /**
   * Resolves the base template and evaluates workflow rules in-memory for a request.
   * This is a pure read operation: NO database mutations or dynamic template creations.
   */
  public static async evaluateWorkflowForRequest(request: {
    type: RequestType;
    priority: Priority;
    status: string;
    workflowTemplate: {
      name: string;
      version: number;
      steps: WorkflowStep[];
    };
    requestedBy: {
      role: UserRole;
      department: { code: string };
    };
    purchaseDetail?: { estimatedCost?: any } | null;
    leaveDetail?: { leaveType?: string; totalDays?: number } | null;
    maintenanceDetail?: { urgencyLevel?: string } | null;
  }): Promise<{
    baseTemplate: any;
    baseSteps: WorkflowStep[];
    adjustedSteps: WorkflowStep[];
    stepsModified: boolean;
  }> {
    let baseTemplate: (typeof request.workflowTemplate) | null = null;
    if (!request.workflowTemplate.name.startsWith('Dynamic:')) {
      baseTemplate = request.workflowTemplate;
    } else {
      // It is dynamic: resolve the base template matching the request's original template version.
      baseTemplate = await prisma.workflowTemplate.findFirst({
        where: {
          requestType: request.type,
          version: request.workflowTemplate.version,
          deletedAt: null,
          NOT: { name: { startsWith: 'Dynamic:' } },
        },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      });

      // If no matching version is found, fallback to the latest active base template
      if (!baseTemplate) {
        baseTemplate = await prisma.workflowTemplate.findFirst({
          where: {
            requestType: request.type,
            isActive: true,
            deletedAt: null,
            NOT: { name: { startsWith: 'Dynamic:' } },
          },
          orderBy: { version: 'desc' },
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        });
      }
    }

    const baseSteps = baseTemplate ? baseTemplate.steps : request.workflowTemplate.steps;

    // Construct rule context with requesterRole & numerical cost
    const ctx: RuleContext = {
      type: request.type,
      priority: request.priority,
      departmentCode: request.requestedBy.department.code,
      requesterRole: request.requestedBy.role,
      details: {
        estimatedCost:
          request.purchaseDetail?.estimatedCost != null
            ? Number(request.purchaseDetail.estimatedCost)
            : undefined,
        leaveType: request.leaveDetail?.leaveType,
        urgencyLevel: request.maintenanceDetail?.urgencyLevel,
        totalDays: request.leaveDetail?.totalDays,
      },
    };

    const adjustedSteps = evaluateRules(ctx, baseSteps);

    const stepsModified =
      adjustedSteps.length !== baseSteps.length ||
      adjustedSteps.some((step, idx) => step.approverRole !== baseSteps[idx]?.approverRole);

    return {
      baseTemplate,
      baseSteps,
      adjustedSteps,
      stepsModified,
    };
  }

  /**
   * Calculates a read-only preview of workflow steps for draft and returned requests
   * using the authoritative business rules without persisting any changes or dynamic
   * templates to the database.
   *
   * For in-flight or completed requests, it preserves their persisted materialized steps.
   */
  public static async previewStepsForRequest(request: any): Promise<WorkflowStep[]> {
    if (
      request.status !== 'DRAFT' &&
      request.status !== 'RETURNED' &&
      request.workflowTemplate?.steps &&
      request.workflowTemplate.steps.length > 0
    ) {
      return request.workflowTemplate.steps;
    }

    const { adjustedSteps } = await this.evaluateWorkflowForRequest(request);
    return adjustedSteps;
  }

  private static async resolveStepsInternal(requestId: string): Promise<WorkflowStep[]> {
    // 1. Fetch request with detail tables and current template steps
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        workflowTemplate: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        },
        requestedBy: {
          include: {
            department: true,
          },
        },
        purchaseDetail: true,
        leaveDetail: true,
        maintenanceDetail: true,
        generalDetail: true,
      },
    });

    assertActiveRequest(request);

    // 2. In-flight stability safeguard:
    // If the request is already active or closed, it MUST strictly follow its already
    // materialized steps and template. Never re-resolve or mutate in-flight requests!
    if (
      request.status !== 'DRAFT' &&
      request.status !== 'RETURNED' &&
      request.workflowTemplate.steps &&
      request.workflowTemplate.steps.length > 0
    ) {
      return request.workflowTemplate.steps;
    }

    const { baseTemplate, baseSteps, adjustedSteps, stepsModified } =
      await this.evaluateWorkflowForRequest(request);

    if (!stepsModified) {
      // If request was previously linked to a dynamic template, revert to base template
      if (request.workflowTemplate.name.startsWith('Dynamic:') && baseTemplate) {
        await prisma.request.update({
          where: { id: requestId },
          data: { workflowTemplateId: baseTemplate.id },
        });
      }
      return baseSteps;
    }

    // 5. Steps are modified — check if existing dynamic template already matches
    if (request.workflowTemplate.name.startsWith('Dynamic:')) {
      const dynamicSteps = request.workflowTemplate.steps;
      const dynamicMatches =
        dynamicSteps.length === adjustedSteps.length &&
        adjustedSteps.every(
          (step, idx) =>
            step.approverRole === dynamicSteps[idx]?.approverRole &&
            step.order === dynamicSteps[idx]?.order &&
            step.stepName === dynamicSteps[idx]?.stepName
        );

      if (dynamicMatches) {
        return dynamicSteps;
      }
    }

    const dynamicTemplateName = `Dynamic: ${baseTemplate?.name || request.workflowTemplate.name} for ${request.referenceNumber}`;

    // Execute dynamic template creation, step recreation, and request linkage in an atomic transaction
    const savedSteps = await prisma.$transaction(async (tx) => {
      let targetTemplate = await tx.workflowTemplate.findFirst({
        where: { name: dynamicTemplateName, deletedAt: null },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      });

      if (!targetTemplate) {
        targetTemplate = await tx.workflowTemplate.create({
          data: {
            name: dynamicTemplateName,
            requestType: request.type,
            version: baseTemplate?.version ?? 1,
            description: `Custom flow generated by rules engine for request ${request.referenceNumber}`,
            isActive: false, // Critical: dynamic templates must never be active base templates
          },
          include: {
            steps: { orderBy: { order: 'asc' } },
          },
        });
      }

      const existingSteps = targetTemplate.steps || [];
      const dynamicMatches =
        existingSteps.length === adjustedSteps.length &&
        adjustedSteps.every(
          (step, idx) =>
            step.approverRole === existingSteps[idx]?.approverRole &&
            step.order === existingSteps[idx]?.order &&
            step.stepName === existingSteps[idx]?.stepName
        );

      if (dynamicMatches) {
        if (request.workflowTemplateId !== targetTemplate.id) {
          await tx.request.update({
            where: { id: requestId },
            data: { workflowTemplateId: targetTemplate.id },
          });
        }
        return existingSteps;
      }

      // If steps exist but differ, remove old dynamic steps before inserting new ones
      if (existingSteps.length > 0) {
        await tx.workflowStep.deleteMany({
          where: { templateId: targetTemplate.id },
        });
      }

      // Link request to the dynamic template
      await tx.request.update({
        where: { id: requestId },
        data: { workflowTemplateId: targetTemplate.id },
      });

      // Save the new dynamic steps atomically
      const createdSteps: WorkflowStep[] = [];
      for (const step of adjustedSteps) {
        const created = await tx.workflowStep.create({
          data: {
            templateId: targetTemplate.id,
            stepName: step.stepName,
            order: step.order,
            approverRole: step.approverRole,
            approverDepartmentId: step.approverDepartmentId,
            allowDynamicForwarding: step.allowDynamicForwarding ?? true,
            isFinal: step.isFinal,
          },
        });
        createdSteps.push(created);
      }

      return createdSteps.sort((a, b) => a.order - b.order);
    });

    return savedSteps;
  }

  /**
   * Retrieves the next step in the flow after the current step.
   */
  public static async getNextStep(
    requestId: string,
    currentStepId: string
  ): Promise<WorkflowStep | null> {
    const steps = await this.getStepsForRequest(requestId);
    const currentIdx = steps.findIndex((s) => s.id === currentStepId);

    if (currentIdx === -1 || currentIdx === steps.length - 1) {
      return null;
    }

    return steps[currentIdx + 1] || null;
  }
}
