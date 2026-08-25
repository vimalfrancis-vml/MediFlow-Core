import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

export class DepartmentService {
  static async getDepartments() {
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
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

  static async updateDepartmentHod(departmentId: string, hodId: string | null) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new AppError('Department not found', 404);
    }

    if (hodId) {
      const user = await prisma.user.findUnique({ where: { id: hodId } });
      if (!user) {
        throw new AppError('Selected HOD user not found', 404);
      }
      // Ensure user role is updated to HOD if not already HOD or ADMIN
      if (user.role !== 'HOD' && user.role !== 'ADMIN') {
        await prisma.user.update({
          where: { id: hodId },
          data: { role: 'HOD', departmentId }
        });
      }
    }

    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: { hodId: hodId || null },
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
}
