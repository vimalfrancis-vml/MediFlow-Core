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
  }) {
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

    if (data.hodId) {
      const hodUser = await prisma.user.findUnique({ where: { id: data.hodId, isActive: true } });
      if (!hodUser) {
        throw new AppError('Specified HOD user not found or inactive', 400);
      }
    }

    const department = await prisma.department.create({
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

    return department;
  }

  static async updateDepartment(id: string, data: {
    name?: string;
    displayName?: string;
    hodId?: string | null;
    isActive?: boolean;
  }) {
    const department = await prisma.department.findUnique({ where: { id } });
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

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.displayName !== undefined) updateData.displayName = data.displayName ? data.displayName.trim() : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (data.hodId !== undefined) {
      if (data.hodId) {
        const user = await prisma.user.findUnique({ where: { id: data.hodId, isActive: true } });
        if (!user) {
          throw new AppError('Selected HOD user not found or inactive', 404);
        }
        updateData.hodId = data.hodId;
        // Optionally align user role to HOD if not already admin
        if (user.role !== 'HOD' && user.role !== 'ADMIN') {
          await prisma.user.update({
            where: { id: data.hodId },
            data: { role: 'HOD', departmentId: id }
          });
        }
      } else {
        updateData.hodId = null;
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });

    return updated;
  }

  static async updateDepartmentHod(departmentId: string, hodId: string | null) {
    return this.updateDepartment(departmentId, { hodId });
  }

  static async setDepartmentStatus(departmentId: string, isActive: boolean) {
    return this.updateDepartment(departmentId, { isActive });
  }
}
