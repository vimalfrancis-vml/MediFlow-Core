import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { RequestType, UserRole } from '@prisma/client';

export interface WorkflowStepInput {
  stepName: string;
  order: number;
  approverRole: string;
  approverDepartmentId?: string | null;
  allowDynamicForwarding?: boolean;
  isFinal?: boolean;
}

export class WorkflowService {
  /**
   * Authoritative backend validation for workflow step configurations.
   */
  public static async validateWorkflowConfiguration(steps: WorkflowStepInput[]): Promise<void> {
    if (!steps || steps.length === 0) {
      throw new AppError('A workflow template must contain at least one step.', 400);
    }

    // Sort by declared order to inspect sequence
    const sorted = [...steps].sort((a, b) => a.order - b.order);

    // Validate sequential 1-based ordering
    for (let i = 0; i < sorted.length; i++) {
      const expectedOrder = i + 1;
      if (sorted[i]!.order !== expectedOrder) {
        throw new AppError(`Invalid step ordering: step "${sorted[i]!.stepName}" has order ${sorted[i]!.order}, expected ${expectedOrder}. Step sequence must be consecutive without gaps.`, 400);
      }
      if (!sorted[i]!.stepName || !sorted[i]!.stepName.trim()) {
        throw new AppError(`Step ${expectedOrder} must have a valid step name.`, 400);
      }
    }

    // Validate roles and departments
    const activeRoles = await prisma.role.findMany({
      where: { isActive: true },
      select: { code: true, id: true },
    });
    const validRoleCodes = new Set(activeRoles.map((r) => r.code));
    const validRoleIds = new Set(activeRoles.map((r) => r.id));

    const activeDepartments = await prisma.department.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true },
    });
    const validDeptIds = new Set(activeDepartments.map((d) => d.id));

    for (const step of sorted) {
      const roleValid = validRoleCodes.has(step.approverRole) || validRoleIds.has(step.approverRole);
      if (!roleValid) {
        throw new AppError(`Role '${step.approverRole}' in step "${step.stepName}" does not exist or is inactive.`, 400);
      }

      if (step.approverDepartmentId) {
        if (!validDeptIds.has(step.approverDepartmentId)) {
          throw new AppError(`Department '${step.approverDepartmentId}' in step "${step.stepName}" does not exist or is inactive.`, 400);
        }
      }
    }

    // Check for identical consecutive duplicate stages without distinct scope
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (
        prev.approverRole === curr.approverRole &&
        prev.approverDepartmentId === curr.approverDepartmentId
      ) {
        throw new AppError(`Redundant step configuration: consecutive step "${curr.stepName}" has the identical approver role and department scope as step "${prev.stepName}".`, 400);
      }
    }
  }

  /**
   * Retrieve list of workflow templates.
   */
  static async getTemplates(filter?: { requestType?: RequestType; isActive?: boolean }) {
    const where: any = {
      deletedAt: null,
      NOT: { name: { startsWith: 'Dynamic:' } },
    };

    if (filter?.requestType) where.requestType = filter.requestType;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const templates = await prisma.workflowTemplate.findMany({
      where,
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            approverDepartment: {
              select: { id: true, name: true, code: true, displayName: true },
            },
          },
        },
        _count: {
          select: { requests: true },
        },
      },
      orderBy: [
        { requestType: 'asc' },
        { version: 'desc' },
      ],
    });

    return templates;
  }

  /**
   * Retrieve a single template by ID.
   */
  static async getTemplateById(id: string) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            approverDepartment: {
              select: { id: true, name: true, code: true, displayName: true },
            },
          },
        },
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!template) {
      throw new AppError('Workflow template not found', 404);
    }

    return template;
  }

  /**
   * Create a new workflow template and activate it.
   */
  static async createTemplate(data: {
    name: string;
    requestType: RequestType;
    description?: string;
    steps: WorkflowStepInput[];
  }) {
    if (!data.name || !data.name.trim()) {
      throw new AppError('Workflow template name is required', 400);
    }
    if (!data.requestType) {
      throw new AppError('Request type is required', 400);
    }

    await this.validateWorkflowConfiguration(data.steps);

    // Resolve latest version for this request type
    const latest = await prisma.workflowTemplate.findFirst({
      where: {
        requestType: data.requestType,
        NOT: { name: { startsWith: 'Dynamic:' } },
      },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latest?.version ?? 0) + 1;

    // Run in transaction: deactivate previous active templates for this type and create new
    return prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.updateMany({
        where: {
          requestType: data.requestType,
          isActive: true,
          NOT: { name: { startsWith: 'Dynamic:' } },
        },
        data: { isActive: false },
      });

      const template = await tx.workflowTemplate.create({
        data: {
          name: data.name.trim(),
          requestType: data.requestType,
          version: newVersion,
          isActive: true,
          description: data.description ? data.description.trim() : null,
          steps: {
            create: data.steps.map((s, idx) => ({
              stepName: s.stepName.trim(),
              order: idx + 1,
              approverRole: s.approverRole as UserRole,
              approverDepartmentId: s.approverDepartmentId || null,
              allowDynamicForwarding: s.allowDynamicForwarding ?? true,
              isFinal: idx === data.steps.length - 1,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return template;
    });
  }

  /**
   * Create a new version of an existing template.
   * Safe versioning guarantee: existing requests pointing to templateId remain untouched.
   */
  static async createNewVersion(templateId: string, data: {
    name?: string;
    description?: string;
    steps: WorkflowStepInput[];
  }) {
    const existing = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      throw new AppError('Base workflow template not found', 404);
    }

    await this.validateWorkflowConfiguration(data.steps);

    // Find highest version
    const latest = await prisma.workflowTemplate.findFirst({
      where: {
        requestType: existing.requestType,
        NOT: { name: { startsWith: 'Dynamic:' } },
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? existing.version) + 1;

    return prisma.$transaction(async (tx) => {
      // Archive / mark previous active templates of this type inactive
      await tx.workflowTemplate.updateMany({
        where: {
          requestType: existing.requestType,
          isActive: true,
          NOT: { name: { startsWith: 'Dynamic:' } },
        },
        data: { isActive: false },
      });

      const newTemplate = await tx.workflowTemplate.create({
        data: {
          name: data.name && data.name.trim() ? data.name.trim() : existing.name,
          requestType: existing.requestType,
          version: nextVersion,
          isActive: true,
          description: data.description !== undefined ? data.description : existing.description,
          steps: {
            create: data.steps.map((s, idx) => ({
              stepName: s.stepName.trim(),
              order: idx + 1,
              approverRole: s.approverRole as UserRole,
              approverDepartmentId: s.approverDepartmentId || null,
              allowDynamicForwarding: s.allowDynamicForwarding ?? true,
              isFinal: idx === data.steps.length - 1,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });

      return newTemplate;
    });
  }

  /**
   * Soft-delete / archive a workflow template.
   * Never hard-deletes rows; keeps historical references for existing requests and audits.
   * Outage safeguard: Prevents archiving/deactivating if it would leave the request type with zero valid templates.
   * If the currently active template is archived and other valid templates exist, atomically promotes the latest remaining version.
   */
  static async archiveTemplate(templateId: string) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: { requests: true },
        },
      },
    });

    if (!template) {
      throw new AppError('Workflow template not found', 404);
    }

    const remainingTemplates = await prisma.workflowTemplate.findMany({
      where: {
        requestType: template.requestType,
        deletedAt: null,
        id: { not: templateId },
        NOT: { name: { startsWith: 'Dynamic:' } },
      },
      orderBy: { version: 'desc' },
    });

    if (remainingTemplates.length === 0) {
      throw new AppError(
        `Cannot archive or deactivate the only active workflow template for request type ${template.requestType}. An active workflow must always exist.`,
        400
      );
    }

    return prisma.$transaction(async (tx) => {
      const archived = await tx.workflowTemplate.update({
        where: { id: templateId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      // If the archived template was active, ensure a fallback template is promoted so activeCount remains >= 1
      if (template.isActive) {
        const hasActiveRemaining = remainingTemplates.some((t) => t.isActive);
        if (!hasActiveRemaining) {
          const fallback = remainingTemplates[0]!;
          await tx.workflowTemplate.update({
            where: { id: fallback.id },
            data: { isActive: true },
          });

          await tx.auditLog.create({
            data: {
              action: 'WORKFLOW_ACTIVATED',
              description: `Workflow template "${fallback.name}" (v${fallback.version}) restored as active for request type ${fallback.requestType} following archival of version ${template.version}.`,
            },
          });
        }
      }

      return archived;
    });
  }

  /**
   * Explicitly activates a workflow template.
   * Atomically deactivates any existing active templates for this request type.
   * Validates workflow step configuration before activation to prevent corrupt workflows.
   */
  static async activateTemplate(templateId: string) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    if (!template) {
      throw new AppError('Workflow template not found', 404);
    }

    if (template.deletedAt) {
      throw new AppError('Cannot activate an archived workflow template', 400);
    }

    // Validate workflow configuration before activation
    await this.validateWorkflowConfiguration(template.steps);

    return prisma.$transaction(async (tx) => {
      // Deactivate other active template(s) for this request type
      await tx.workflowTemplate.updateMany({
        where: {
          requestType: template.requestType,
          isActive: true,
          id: { not: templateId },
          NOT: { name: { startsWith: 'Dynamic:' } },
        },
        data: { isActive: false },
      });

      const activated = await tx.workflowTemplate.update({
        where: { id: templateId },
        data: { isActive: true },
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'WORKFLOW_ACTIVATED',
          description: `Workflow template "${activated.name}" (v${activated.version}) activated for request type ${activated.requestType}.`,
        },
      });

      return activated;
    });
  }

  /**
   * Deactivates a workflow template (alias to archiveTemplate to enforce active template outage protection).
   */
  static async deactivateTemplate(templateId: string) {
    return this.archiveTemplate(templateId);
  }
}
