import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import {
  generateSecureTemporaryPassword,
  validatePasswordStrength,
} from '../utils/passwordPolicy';
import { clearUserSessionCache } from '../middleware/auth';

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
        mustChangePassword: true,
        phone: true,
        notificationPreferences: true,
        languagePreference: true,
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
        mustChangePassword: true,
        phone: true,
        notificationPreferences: true,
        languagePreference: true,
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
    phone?: string;
    languagePreference?: string;
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

    // Secure temporary password handling
    let plainPassword = data.password && data.password.trim() ? data.password.trim() : '';
    if (plainPassword) {
      const validation = validatePasswordStrength(plainPassword, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: emailTrimmed,
      });
      if (!validation.valid) {
        throw new AppError(validation.errors[0] || 'Password does not meet complexity requirements', 400);
      }
    } else {
      plainPassword = generateSecureTemporaryPassword();
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const temporaryPasswordExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

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
        mustChangePassword: true,
        temporaryPasswordExpiresAt,
        tokenVersion: 0,
        phone: data.phone?.trim() || null,
        languagePreference: data.languagePreference || 'en',
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
        mustChangePassword: true,
        temporaryPasswordExpiresAt: true,
        phone: true,
        languagePreference: true,
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

    await prisma.auditLog.create({
      data: {
        action: 'USER_CREATED',
        description: `User account created for ${newUser.firstName} ${newUser.lastName} (${newUser.email}) with temporary password expiring in 72 hours.`,
      },
    });

    return {
      ...newUser,
      temporaryPassword: plainPassword,
    };
  }

  static async updateUser(id: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    roleId?: string;
    departmentId?: string;
    isActive?: boolean;
    phone?: string;
    languagePreference?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim().slice(0, 30) : null;
    if (data.languagePreference !== undefined) updateData.languagePreference = data.languagePreference.trim().slice(0, 10);

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
          mustChangePassword: true,
          phone: true,
          languagePreference: true,
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
      if (data.departmentId !== undefined && updated.department?.id !== user.departmentId) {
        changes.push(`Department changed to ${updated.department?.name || updated.department?.code}`);
      }
      if (data.isActive !== undefined && updated.isActive !== user.isActive) {
        changes.push(`Account ${updated.isActive ? 'activated' : 'deactivated'}`);
      }

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

    clearUserSessionCache(id);
    return updatedUser;
  }

  static async resetUserPassword(adminUserId: string, targetUserId: string, adminPassword?: string) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.deletedAt !== null) {
      throw new AppError('User not found', 404);
    }

    // Privileged account protection: ADMIN, HOD, DIRECTOR require admin re-authentication
    const privilegedRoles: UserRole[] = [UserRole.ADMIN, UserRole.HOD, UserRole.DIRECTOR];
    if (privilegedRoles.includes(targetUser.role)) {
      if (!adminPassword) {
        throw new AppError('Admin re-authentication password is required to reset a privileged account.', 403);
      }
      const adminUser = await prisma.user.findUnique({
        where: { id: adminUserId },
      });
      if (!adminUser || !(await bcrypt.compare(adminPassword, adminUser.passwordHash))) {
        throw new AppError('Invalid admin credentials provided for re-authentication.', 403);
      }
    }

    const temporaryPassword = generateSecureTemporaryPassword();
    const newPasswordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: expiresAt,
        tokenVersion: { increment: 1 },
      },
    });

    // Invalidate session cache for the affected user
    clearUserSessionCache(targetUserId);

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        action: 'USER_PASSWORD_RESET',
        description: `Administrator reset password for ${targetUser.email}. Temporary password expires in 72 hours.`,
      },
    });

    return {
      temporaryPassword,
      expiresAt,
    };
  }

  static async updateUserProfile(userId: string, data: {
    phone?: string;
    notificationPreferences?: any;
    languagePreference?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.deletedAt !== null) {
      throw new AppError('User not found', 404);
    }

    const updateData: any = {};
    if (data.phone !== undefined) {
      updateData.phone = data.phone ? String(data.phone).trim().slice(0, 30) : null;
    }
    if (data.notificationPreferences !== undefined) {
      updateData.notificationPreferences = data.notificationPreferences;
    }
    if (data.languagePreference !== undefined) {
      updateData.languagePreference = String(data.languagePreference).trim().slice(0, 10) || 'en';
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        phone: true,
        notificationPreferences: true,
        languagePreference: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
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

  /**
   * Permanently deletes a user account from the database.
   *
   * Before deletion the method checks every hard foreign-key dependency that
   * would block the DELETE or silently corrupt historical data:
   *   - Request.requestedById  (non-nullable FK → cannot be nulled)
   *   - Department.hodId       (nullable FK → safe to null before delete)
   *   - Request.assignedToUserId (nullable FK → safe to null before delete)
   *   - GeneralDetail.targetUserId (nullable FK → safe to null before delete)
   *
   * Fields stored as plain strings (no DB-level FK) are left untouched so that
   * historical audit / approval / comment / notification records remain intact:
   *   ApprovalAction.actorId, Comment.authorId, Attachment.uploadedById,
   *   Notification.recipientId, AuditLog.actorId
   *
   * EmployeePosition rows are removed by cascade (onDelete: Cascade in schema).
   *
   * @param targetId   UUID of the user to delete
   * @param actorId    UUID of the administrator performing the deletion
   */
  static async deleteUser(targetId: string, actorId: string) {
    // 1. Load the target user
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt !== null) {
      throw new AppError('User not found', 404);
    }

    // 2. Prevent self-deletion
    if (targetId === actorId) {
      throw new AppError('You cannot delete your own account.', 400);
    }

    // 3. Prevent deleting the last active ADMIN
    if (user.role === UserRole.ADMIN) {
      const otherActiveAdmins = await prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
          deletedAt: null,
          id: { not: targetId },
        },
      });
      if (otherActiveAdmins === 0) {
        throw new AppError(
          'Cannot delete the last active Administrator account. At least one active Administrator must remain.',
          400
        );
      }
    }

    // 4. Hard dependency check: requests submitted BY this user (non-nullable FK)
    const ownedRequestCount = await prisma.request.count({
      where: { requestedById: targetId },
    });

    if (ownedRequestCount > 0) {
      throw new AppError(
        `Cannot permanently delete this account. The user has ${ownedRequestCount} request${ownedRequestCount !== 1 ? 's' : ''} on record that reference them as the requester. ` +
          'Deleting this account would violate database integrity and destroy historical request records. ' +
          'If you no longer need this user to log in, deactivate the account instead.',
        409
      );
    }

    // 5. All remaining hard constraints are nullable — resolve them inside a transaction
    const fullName = `${user.firstName} ${user.lastName}`;

    await prisma.$transaction(async (tx) => {
      // 5a. Remove HOD assignment from any department this user heads
      await tx.department.updateMany({
        where: { hodId: targetId },
        data: { hodId: null },
      });

      // 5b. Null out nullable Request.assignedToUserId references
      await tx.request.updateMany({
        where: { assignedToUserId: targetId },
        data: { assignedToUserId: null },
      });

      // 5c. Null out nullable GeneralDetail.targetUserId references
      await tx.generalDetail.updateMany({
        where: { targetUserId: targetId },
        data: { targetUserId: null },
      });

      // 5d. Write audit log BEFORE deleting the user so actorId is resolvable
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_PERMANENTLY_DELETED',
          description:
            `Administrator permanently deleted user account: ${fullName} ` +
            `(${user.email}, Employee ID: ${user.employeeId}, Role: ${user.role}). ` +
            `This action is irreversible.`,
        },
      });

      // 5e. Delete the user record (EmployeePosition rows cascade automatically)
      await tx.user.delete({ where: { id: targetId } });
    });

    // 6. Clear any in-memory session cache for the deleted user
    clearUserSessionCache(targetId);

    return {
      id: targetId,
      employeeId: user.employeeId,
      email: user.email,
      fullName,
    };
  }
}
