import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

export class DepartmentService {
  static async getDepartments(filter?: { isActive?: boolean }) {
    const where: any = { deletedAt: null };
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const departments = await prisma.department.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        displayName: true,
        isActive: true,
        createdAt: true,
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        _count: {
          select: {
            users: true,
            requests: {
              where: {
                status: 'IN_REVIEW'
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc',
      },
    });
    return departments;
  }

  static async getDepartmentById(id: string) {
    const department = await prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        displayName: true,
        isActive: true,
        createdAt: true,
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        _count: {
          select: {
            users: true,
            requests: {
              where: {
                status: 'IN_REVIEW'
              }
            }
          }
        },
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            roleRef: {
              select: {
                displayName: true,
              },
            },
            email: true,
            isActive: true,
          },
          orderBy: {
            firstName: 'asc'
          }
        }
      },
    });

    if (!department) {
      throw new AppError('Department not found', 404);
    }

    return department;
  }

  static async createDepartment(data: {
    name: string;
    code: string;
    displayName?: string;
    hodId?: string;
  }, actor?: { id: string }) {
    if (!data.name || !data.name.trim()) {
      throw new AppError('Department name is required', 400);
    }
    if (!data.code || !data.code.trim()) {
      throw new AppError('Department code is required', 400);
    }

    const codeUpper = data.code.trim().toUpperCase();
    const existing = await prisma.department.findUnique({ where: { code: codeUpper } });
    if (existing) {
      throw new AppError(`Department with code '${codeUpper}' already exists`, 400);
    }

    let hodUser: { id: string; firstName: string; lastName: string; email: string } | null = null;
    if (data.hodId) {
      hodUser = await prisma.user.findUnique({
        where: { id: data.hodId, isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!hodUser) {
        throw new AppError('Specified HOD user not found or inactive', 400);
      }
    }

    return prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: {
          name: data.name.trim(),
          code: codeUpper,
          displayName: data.displayName ? data.displayName.trim() : data.name.trim(),
          hodId: data.hodId || null,
        },
        include: {
          hod: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const hodDesc = hodUser ? ` Assigned HOD: ${hodUser.firstName} ${hodUser.lastName} (${hodUser.email}).` : '';
      await tx.auditLog.create({
        data: {
          actorId: actor?.id,
          action: 'DEPARTMENT_CREATED',
          description: `Department "${department.name}" (${department.code}) was created.${hodDesc}`,
        },
      });

      return department;
    });
  }

  static async updateDepartment(id: string, data: {
    name?: string;
    displayName?: string;
    hodId?: string | null;
    isActive?: boolean;
  }, actor?: { id: string }) {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    const updateData: any = {};
    if (data.isActive === false && department.isActive === true) {
      // Guard 1: Cannot deactivate mandatory system departments like Cardiology, Finance, HR
      if (['CARD', 'FIN', 'HR'].includes(department.code)) {
        throw new AppError(`Cannot deactivate system department '${department.name}' (${department.code}) as it is required for mandatory system workflow routing.`, 400);
      }

      // Guard 2: Check if any active workflow step specifically targets this department
      const stepUsage = await prisma.workflowStep.findFirst({
        where: {
          approverDepartmentId: id,
          template: { isActive: true, deletedAt: null },
        },
        include: { template: true },
      });

      if (stepUsage) {
        throw new AppError(`Cannot deactivate department '${department.name}' because active workflow '${stepUsage.template.name}' requires it for step '${stepUsage.stepName}'.`, 400);
      }
    }

    const changes: string[] = [];

    if (data.name !== undefined && data.name.trim() && data.name.trim() !== department.name) {
      changes.push(`Name changed from "${department.name}" to "${data.name.trim()}"`);
      updateData.name = data.name.trim();
    }
    if (data.displayName !== undefined) {
      const newDisplay = data.displayName ? data.displayName.trim() : null;
      if (newDisplay !== department.displayName) {
        changes.push(`Display name changed from "${department.displayName || '(none)'}" to "${newDisplay || '(none)'}"`);
        updateData.displayName = newDisplay;
      }
    }
    if (data.isActive !== undefined && data.isActive !== department.isActive) {
      changes.push(`Status changed from ${department.isActive ? 'Active' : 'Inactive'} to ${data.isActive ? 'Active' : 'Inactive'}`);
      updateData.isActive = data.isActive;
    }

    let targetHodUser: { id: string; firstName: string; lastName: string; email: string; role: string } | null = null;
    if (data.hodId !== undefined && data.hodId !== department.hodId) {
      if (data.hodId) {
        targetHodUser = await prisma.user.findUnique({
          where: { id: data.hodId, isActive: true },
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        });
        if (!targetHodUser) {
          throw new AppError('Selected HOD user not found or inactive', 404);
        }
        updateData.hodId = data.hodId;
        changes.push(`HOD assigned to ${targetHodUser.firstName} ${targetHodUser.lastName} (${targetHodUser.email})`);
      } else {
        updateData.hodId = null;
        changes.push('HOD removed');
      }
    }

    return prisma.$transaction(async (tx) => {
      if (targetHodUser && targetHodUser.role !== 'HOD' && targetHodUser.role !== 'ADMIN') {
        await tx.user.update({
          where: { id: targetHodUser.id },
          data: { role: 'HOD', departmentId: id },
        });
      }

      const updated = await tx.department.update({
        where: { id },
        data: updateData,
        include: {
          hod: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            actorId: actor?.id,
            action: 'DEPARTMENT_UPDATED',
            description: `Department "${updated.name}" (${updated.code}) updated: ${changes.join(', ')}.`,
          },
        });
      }

      return updated;
    });
  }

  static async updateDepartmentHod(departmentId: string, hodId: string | null, actor?: { id: string }) {
    return this.updateDepartment(departmentId, { hodId }, actor);
  }

  static async setDepartmentStatus(departmentId: string, isActive: boolean, actor?: { id: string }) {
    return this.updateDepartment(departmentId, { isActive }, actor);
  }
}
