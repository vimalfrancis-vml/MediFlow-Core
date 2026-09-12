import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

export class UserService {
  static async getUsers(filter?: { departmentId?: string; role?: string; isActive?: boolean }) {
    const where: any = { deletedAt: null };
    if (filter?.departmentId) where.departmentId = filter.departmentId;
    if (filter?.role) where.role = filter.role as UserRole;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        roleRef: {
          select: {
            id: true,
            code: true,
            displayName: true,
            description: true,
            isSystem: true,
            isActive: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
            isActive: true,
          },
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
        roleId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        roleRef: {
          select: {
            id: true,
            code: true,
            displayName: true,
            description: true,
            isSystem: true,
            isActive: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
            isActive: true,
          },
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
    role: string;
    roleId?: string;
    departmentId: string;
    isActive?: boolean;
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

    const emailTrimmed = data.email.trim().toLowerCase();
    const existingEmail = await prisma.user.findUnique({ where: { email: emailTrimmed } });
    if (existingEmail) {
      throw new AppError('User with this email already exists', 400);
    }

    const existingEmp = await prisma.user.findUnique({ where: { employeeId: data.employeeId.trim() } });
    if (existingEmp) {
      throw new AppError('User with this Employee ID already exists', 400);
    }

    // Validate active department
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId, isActive: true },
    });
    if (!department) {
      throw new AppError('Specified department does not exist or is inactive', 400);
    }

    // Authoritative role lookup from Role table
    const targetRoleIdentifier = data.roleId || data.role;
    const roleRecord = await prisma.role.findFirst({
      where: {
        OR: [
          { id: targetRoleIdentifier },
          { code: targetRoleIdentifier },
        ],
        isActive: true,
      },
    });

    if (!roleRecord) {
      throw new AppError(`Specified role '${targetRoleIdentifier}' does not exist or is inactive`, 400);
    }

    const plainPassword = data.password && data.password.trim() ? data.password.trim() : 'password123';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const newUser = await prisma.user.create({
      data: {
        email: emailTrimmed,
        employeeId: data.employeeId.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: roleRecord.code as UserRole,
        roleId: roleRecord.id,
        departmentId: department.id,
        passwordHash,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        roleRef: {
          select: {
            id: true,
            code: true,
            displayName: true,
            description: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
          },
        },
      },
    });

    if (roleRecord.code === UserRole.ADMIN) {
      await prisma.auditLog.create({
        data: {
          action: 'ADMIN_PRIVILEGE_GRANTED',
          description: `New Administrator account created for ${newUser.firstName} ${newUser.lastName} (${newUser.email}) with employee ID ${newUser.employeeId}.`,
        },
      });
    }

    return newUser;
  }

  static async updateUser(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    roleId?: string;
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
    if (data.email !== undefined) {
      const emailTrimmed = data.email.trim().toLowerCase();
      if (emailTrimmed !== user.email) {
        const existing = await prisma.user.findUnique({ where: { email: emailTrimmed } });
        if (existing) {
          throw new AppError('User with this email already exists', 400);
        }
        updateData.email = emailTrimmed;
      }
    }

    if (data.role !== undefined || data.roleId !== undefined) {
      const targetRoleIdentifier = data.roleId || data.role;
      const roleRecord = await prisma.role.findFirst({
        where: {
          OR: [
            { id: targetRoleIdentifier },
            { code: targetRoleIdentifier },
          ],
          isActive: true,
        },
      });

      if (!roleRecord) {
        throw new AppError(`Specified role '${targetRoleIdentifier}' does not exist or is inactive`, 400);
      }

      updateData.role = roleRecord.code as UserRole;
      updateData.roleId = roleRecord.id;
    }

    if (data.departmentId !== undefined) {
      const department = await prisma.department.findUnique({
        where: { id: data.departmentId, isActive: true },
      });
      if (!department) {
        throw new AppError('Specified department does not exist or is inactive', 400);
      }
      updateData.departmentId = department.id;
    }

    // Protection: Prevent deactivating or demoting the last active ADMIN
    const isTargetCurrentlyAdmin = user.role === UserRole.ADMIN;
    const isDeactivating = data.isActive === false && user.isActive === true;
    const isDemotingAdmin = isTargetCurrentlyAdmin && updateData.role && updateData.role !== UserRole.ADMIN;

    if (isTargetCurrentlyAdmin && (isDeactivating || isDemotingAdmin)) {
      const activeAdminCount = await prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
          deletedAt: null,
          id: { not: id }, // Count other active admins
        },
      });

      if (activeAdminCount === 0) {
        throw new AppError('Cannot deactivate or remove role from the last active Administrator. At least one active Administrator must remain.', 400);
      }
    }

    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.password && data.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(data.password.trim(), 10);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          employeeId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          roleId: true,
          isActive: true,
          roleRef: {
            select: {
              id: true,
              code: true,
              displayName: true,
              description: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true,
              displayName: true,
            },
          },
        },
      });

      // Audit status / role / department changes safely without passwords
      const changes: string[] = [];
      if (data.role !== undefined && updated.role !== user.role) {
        changes.push(`Role changed from ${user.role} to ${updated.role}`);
        if (updated.role === UserRole.ADMIN) {
          await tx.auditLog.create({
            data: {
              action: 'ADMIN_PRIVILEGE_GRANTED',
              description: `User ${updated.firstName} ${updated.lastName} (${updated.email}) was granted Administrator privileges (Role changed from ${user.role} to ADMIN).`,
            },
          });
        }
      }
      if (data.departmentId !== undefined && updated.department?.id !== user.departmentId) changes.push(`Department changed to ${updated.department?.name || updated.department?.code}`);
      if (data.isActive !== undefined && updated.isActive !== user.isActive) changes.push(`Account ${updated.isActive ? 'activated' : 'deactivated'}`);

      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            action: 'USER_UPDATED',
            description: `User ${updated.firstName} ${updated.lastName} (${updated.email}) updated: ${changes.join(', ')}`,
          },
        });
      }

      return updated;
    });

    return updatedUser;
  }

  static async setUserStatus(id: string, isActive: boolean) {
    return this.updateUser(id, { isActive });
  }

  static async assignRole(id: string, roleCodeOrId: string) {
    return this.updateUser(id, { role: roleCodeOrId });
  }

  static async assignDepartment(id: string, departmentId: string) {
    return this.updateUser(id, { departmentId });
  }
}
