// Resolves workflow steps, applying dynamic rules to generate request-specific step sequences
// Evaluates workflow rules to dynamically modify step sequences based on request context
import { prisma } from '../db';
import { WorkflowStep, Request, RequestType } from '@prisma/client';
import { evaluateRules } from './RuleEvaluator';
import { RuleContext } from './workflow.rules';
import { AppError } from '../middleware/errorHandler';

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
  /**
   * Resolves and returns the fully evaluated list of workflow steps for a request.
   * If the request is in DRAFT/SUBMITTED and rules alter the flow, it handles cloning
   * the template to store the request-specific dynamic steps.
   */
  public static async getStepsForRequest(requestId: string): Promise<WorkflowStep[]> {
    // 1. Fetch request with detail tables and current template steps
    const request = await prisma.request.findUniqueOrThrow({
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
      },
    });

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

    // 3. Determine base template for draft/returned requests:
    // If request already has a fixed template (not dynamic), preserve that exact template as base.
    // This guarantees that activating a new version never alters existing requests!
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

    // 3. Construct rule context with requesterRole & numerical cost
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

    // 4. Check if rules modified the steps relative to baseSteps
    const stepsModified =
      adjustedSteps.length !== baseSteps.length ||
      adjustedSteps.some((step, idx) => step.approverRole !== baseSteps[idx]?.approverRole);

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
        adjustedSteps.every((step, idx) => step.approverRole === dynamicSteps[idx]?.approverRole);

      if (dynamicMatches) {
        return dynamicSteps;
      }
    }

    const dynamicTemplateName = `Dynamic: ${baseTemplate?.name || request.workflowTemplate.name} for ${request.referenceNumber}`;

    let targetTemplateId: string;

    if (request.workflowTemplate.name.startsWith('Dynamic:')) {
      targetTemplateId = request.workflowTemplate.id;
      // Delete old dynamic steps for this template
      await prisma.workflowStep.deleteMany({
        where: { templateId: targetTemplateId },
      });
    } else {
      // Find existing dynamic template by name or create a new one
      let existingDynamic = await prisma.workflowTemplate.findFirst({
        where: { name: dynamicTemplateName },
      });

      if (existingDynamic) {
        targetTemplateId = existingDynamic.id;
        await prisma.workflowStep.deleteMany({
          where: { templateId: targetTemplateId },
        });
      } else {
        const newTemplate = await prisma.workflowTemplate.create({
          data: {
            name: dynamicTemplateName,
            requestType: request.type,
            version: baseTemplate?.version ?? 1,
            description: `Custom flow generated by rules engine for request ${request.referenceNumber}`,
            isActive: false, // Critical: dynamic templates must never be active base templates
          },
        });
        targetTemplateId = newTemplate.id;
      }

      await prisma.request.update({
        where: { id: requestId },
        data: { workflowTemplateId: targetTemplateId },
      });
    }

    // Save the new dynamic steps
    const savedSteps = await Promise.all(
      adjustedSteps.map((step) =>
        prisma.workflowStep.create({
          data: {
            templateId: targetTemplateId,
            stepName: step.stepName,
            order: step.order,
            approverRole: step.approverRole,
            approverDepartmentId: step.approverDepartmentId,
            allowDynamicForwarding: step.allowDynamicForwarding ?? true,
            isFinal: step.isFinal,
          },
        })
      )
    );

    return savedSteps.sort((a, b) => a.order - b.order);
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
