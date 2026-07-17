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
}
