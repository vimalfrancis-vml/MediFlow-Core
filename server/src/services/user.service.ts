import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

export class UserService {
  static async getUsers() {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return users;
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }
}
