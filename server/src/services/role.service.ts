import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

export class RoleService {
  static async getRoles(filter?: { isActive?: boolean }) {
    const where: any = {};
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const roles = await prisma.role.findMany({
      where,
      select: {
        id: true,
        code: true,
        displayName: true,
        description: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: {
              where: { deletedAt: null }
            }
          }
        }
      },
      orderBy: {
        code: 'asc',
      },
    });

    return roles;
  }

  static async getRoleById(id: string) {
    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      },
      select: {
        id: true,
        code: true,
        displayName: true,
        description: true,
        isSystem: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: {
              select: {
                id: true,
                name: true,
                code: true,
                displayName: true,
              }
            }
          }
        }
      }
    });

    if (!role) {
      throw new AppError('Role not found', 404);
    }

    return role;
  }

  static async updateRole(
    id: string,
    data: { displayName?: string; description?: string; isActive?: boolean },
    actor?: { id: string }
  ) {
    const role = await prisma.role.findFirst({
      where: {
        OR: [{ id }, { code: id }],
      }
    });

    if (!role) {
      throw new AppError('Role not found', 404);
    }

    if (role.isSystem && data.isActive === false) {
      throw new AppError('Cannot deactivate a built-in system role required for workflow execution', 400);
    }

    const updateData: any = {};
    const changes: string[] = [];

    if (data.displayName !== undefined && data.displayName.trim() && data.displayName.trim() !== role.displayName) {
      changes.push(`Display name changed from "${role.displayName}" to "${data.displayName.trim()}"`);
      updateData.displayName = data.displayName.trim();
    }
    if (data.description !== undefined) {
      const newDesc = data.description ? data.description.trim() : null;
      if (newDesc !== role.description) {
        changes.push('Description updated');
        updateData.description = newDesc;
      }
    }
    if (data.isActive !== undefined && data.isActive !== role.isActive) {
      changes.push(`Status changed from ${role.isActive ? 'Active' : 'Inactive'} to ${data.isActive ? 'Active' : 'Inactive'}`);
      updateData.isActive = data.isActive;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id: role.id },
        data: updateData,
      });

      if (changes.length > 0) {
        await tx.auditLog.create({
          data: {
            actorId: actor?.id,
            action: 'ROLE_UPDATED',
            description: `Role "${role.code}" updated: ${changes.join(', ')}.`,
          },
        });
      }

      return updated;
    });
  }
}
