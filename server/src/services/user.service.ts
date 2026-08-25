import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

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

  static async createUser(data: {
    email: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    password?: string;
    role: UserRole;
    departmentId: string;
  }) {
    if (!data.email || !data.email.trim()) {
      throw new AppError('Email is required', 400);
    }
    if (!data.employeeId || !data.employeeId.trim()) {
      throw new AppError('Employee ID is required', 400);
    }
    if (!data.firstName || !data.firstName.trim()) {
      throw new AppError('First name is required', 400);
    }
    if (!data.lastName || !data.lastName.trim()) {
      throw new AppError('Last name is required', 400);
    }
    if (!data.departmentId) {
      throw new AppError('Department is required', 400);
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: data.email.trim() } });
    if (existingEmail) {
      throw new AppError('User with this email already exists', 400);
    }

    const existingEmp = await prisma.user.findUnique({ where: { employeeId: data.employeeId.trim() } });
    if (existingEmp) {
      throw new AppError('User with this Employee ID already exists', 400);
    }

    const plainPassword = data.password && data.password.trim() ? data.password.trim() : 'password123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        email: data.email.trim(),
        employeeId: data.employeeId.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role || UserRole.EMPLOYEE,
        departmentId: data.departmentId,
        passwordHash,
      },
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
        }
      }
    });

    return newUser;
  }

  static async updateUser(id: string, data: {
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    departmentId?: string;
    isActive?: boolean;
    password?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password && data.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(data.password.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
        }
      }
    });

    return updatedUser;
  }
}
