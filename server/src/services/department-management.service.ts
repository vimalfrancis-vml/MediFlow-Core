import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { UserRole, PositionAssignmentType, RequestStatus } from '@prisma/client';
import { generateSecureTemporaryPassword } from '../utils/passwordPolicy';
import bcrypt from 'bcrypt';
import { clearUserSessionCache } from '../middleware/auth';

export interface AuthContextUser {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentCode: string;
  firstName: string;
  lastName: string;
}

export class DepartmentManagementService {
  /**
   * Resolves the authoritative department ID for an operation.
   * If the actor is an HOD, the department ID MUST match actor.departmentId.
   * If the actor is an ADMIN, they may target any active department.
   */
  public static resolveAuthorizedDepartmentId(
    actor: AuthContextUser,
    requestedDepartmentId?: string
  ): string {
    if (actor.role === UserRole.ADMIN) {
      if (!requestedDepartmentId) {
        throw new AppError('Department ID is required for administrator requests.', 400);
      }
      return requestedDepartmentId;
    }

    if (actor.role === UserRole.HOD) {
      if (requestedDepartmentId && requestedDepartmentId !== actor.departmentId) {
        throw new AppError('Access denied. You can only manage your own department.', 403);
      }
      return actor.departmentId;
    }

    throw new AppError('Access denied. Department management requires HOD or Administrator privileges.', 403);
  }

  // ==========================================
  // EMPLOYEE MANAGEMENT
  // ==========================================

  /**
   * Retrieves employees in a department with their active position assignments and stats.
   */
  public static async getDepartmentEmployees(
    actor: AuthContextUser,
    departmentId?: string,
    query?: { search?: string; positionId?: string; status?: string }
  ) {
    const targetDeptId = this.resolveAuthorizedDepartmentId(actor, departmentId);

    const where: any = {
      departmentId: targetDeptId,
      deletedAt: null,
    };

    if (query?.status === 'active') {
      where.isActive = true;
    } else if (query?.status === 'inactive') {
      where.isActive = false;
    } else if (query?.status === 'invited') {
      where.mustChangePassword = true;
      where.isActive = true;
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { employeeId: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query?.positionId && query.positionId.trim()) {
      where.positionAssignments = {
        some: {
          positionId: query.positionId.trim(),
          endDate: null,
        },
      };
    }

    const [employees, allDeptUsers, department] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          roleRef: {
            select: {
              displayName: true,
              code: true,
            },
          },
          positionAssignments: {
            where: { endDate: null },
            include: {
              position: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      // Count aggregate stats for the department
      prisma.user.findMany({
        where: { departmentId: targetDeptId, deletedAt: null },
        select: { id: true, isActive: true, mustChangePassword: true },
      }),
      prisma.department.findUnique({
        where: { id: targetDeptId },
        select: { id: true, name: true, code: true, displayName: true, hodId: true },
      }),
    ]);

    const totalEmployees = allDeptUsers.length;
    const activeEmployees = allDeptUsers.filter((u) => u.isActive).length;
    const inactiveEmployees = allDeptUsers.filter((u) => !u.isActive).length;
    const invitedEmployees = allDeptUsers.filter((u) => u.isActive && u.mustChangePassword).length;

    // Format employee list with primary and acting positions
    const formattedEmployees = employees.map((emp) => {
      const primaryAssignment = emp.positionAssignments.find((a) => a.assignmentType === PositionAssignmentType.PRIMARY);
      const actingAssignments = emp.positionAssignments.filter((a) => a.assignmentType === PositionAssignmentType.ACTING);
      const additionalAssignments = emp.positionAssignments.filter((a) => a.assignmentType === PositionAssignmentType.ADDITIONAL);

      let statusDisplay: 'ACTIVE' | 'INACTIVE' | 'INVITED' = 'ACTIVE';
      if (!emp.isActive) {
        statusDisplay = 'INACTIVE';
      } else if (emp.mustChangePassword) {
        statusDisplay = 'INVITED';
      }

      return {
        id: emp.id,
        employeeId: emp.employeeId,
        email: emp.email,
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone,
        role: emp.role,
        roleDisplayName: emp.roleRef?.displayName || emp.role,
        isActive: emp.isActive,
        mustChangePassword: emp.mustChangePassword,
        status: statusDisplay,
        createdAt: emp.createdAt,
        updatedAt: emp.updatedAt,
        primaryPosition: primaryAssignment?.position
          ? {
              id: primaryAssignment.position.id,
              name: primaryAssignment.position.name,
              assignedAt: primaryAssignment.startDate,
            }
          : null,
        actingPositions: actingAssignments.map((a) => ({
          id: a.position.id,
          name: a.position.name,
          startDate: a.startDate,
          endDate: a.endDate,
        })),
        additionalPositions: additionalAssignments.map((a) => ({
          id: a.position.id,
          name: a.position.name,
          startDate: a.startDate,
        })),
      };
    });

    return {
      department,
      stats: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        invitedEmployees,
      },
      employees: formattedEmployees,
    };
  }

  /**
   * Creates a new employee inside the HOD's department.
   * Enforces:
   * - Department locked to actor's department.
   * - System role strictly locked to EMPLOYEE.
   * - Generates secure temporary password expiring in 72h with mustChangePassword=true.
   * - Atomically assigns the chosen hospital position as PRIMARY.
   */
  public static async createDepartmentEmployee(
    actor: AuthContextUser,
    data: {
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      positionId?: string;
      departmentId?: string;
    }
  ) {
    const targetDeptId = this.resolveAuthorizedDepartmentId(actor, data.departmentId);

    if (!data.employeeId || !data.employeeId.trim()) {
      throw new AppError('Employee ID is required.', 400);
    }
    if (!data.email || !data.email.trim()) {
      throw new AppError('Official email is required.', 400);
    }
    if (!data.firstName || !data.firstName.trim()) {
      throw new AppError('First name is required.', 400);
    }
    if (!data.lastName || !data.lastName.trim()) {
      throw new AppError('Last name is required.', 400);
    }

    const emailClean = data.email.trim().toLowerCase();
    const empIdClean = data.employeeId.trim().toUpperCase();

    // Check existing email
    const existingEmail = await prisma.user.findUnique({ where: { email: emailClean } });
    if (existingEmail) {
      throw new AppError('A user with this email address already exists.', 400);
    }

    // Check existing employeeId
    const existingEmpId = await prisma.user.findUnique({ where: { employeeId: empIdClean } });
    if (existingEmpId) {
      throw new AppError('A user with this Employee ID already exists.', 400);
    }

    // Look up default EMPLOYEE role from Role table
    const employeeRole = await prisma.role.findUnique({
      where: { code: 'EMPLOYEE' },
    });
    if (!employeeRole) {
      throw new AppError('System error: EMPLOYEE role is not configured.', 500);
    }

    // If position is provided, verify it belongs to this department and is active
    let targetPosition: { id: string; name: string } | null = null;
    if (data.positionId) {
      const pos = await prisma.position.findFirst({
        where: { id: data.positionId, departmentId: targetDeptId, isActive: true },
      });
      if (!pos) {
        throw new AppError('Selected hospital position does not exist or is inactive in your department.', 400);
      }
      targetPosition = { id: pos.id, name: pos.name };
    }

    // Password setup: temporary password with 72-hour expiry and mandatory change
    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          employeeId: empIdClean,
          email: emailClean,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone?.trim() || null,
          role: UserRole.EMPLOYEE,
          roleId: employeeRole.id,
          departmentId: targetDeptId,
          passwordHash,
          isActive: true,
          mustChangePassword: true,
          temporaryPasswordExpiresAt: expiresAt,
          tokenVersion: 0,
        },
        select: {
          id: true,
          employeeId: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          departmentId: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      // Create initial primary position assignment if position was selected
      let assignedPosition = null;
      if (targetPosition) {
        const assignment = await tx.employeePosition.create({
          data: {
            userId: newUser.id,
            positionId: targetPosition.id,
            assignmentType: PositionAssignmentType.PRIMARY,
            startDate: new Date(),
            positionNameAtTime: targetPosition.name,
            reason: 'Initial departmental placement',
            createdById: actor.id,
          },
        });
        assignedPosition = {
          id: targetPosition.id,
          name: targetPosition.name,
          assignmentId: assignment.id,
        };
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'EMPLOYEE_CREATED_BY_HOD',
          description: `Department employee ${newUser.firstName} ${newUser.lastName} (${newUser.email}) created by ${actor.firstName} ${actor.lastName}${targetPosition ? ` with position '${targetPosition.name}'` : ''}.`,
        },
      });

      return {
        user: newUser,
        assignedPosition,
        temporaryPassword,
        expiresAt,
      };
    }, { timeout: 20000, maxWait: 10000 });

    return result;
  }

  /**
   * Updates non-security, permitted details for a department employee.
   */
  public static async updateDepartmentEmployee(
    actor: AuthContextUser,
    employeeId: string,
    data: { firstName?: string; lastName?: string; phone?: string }
  ) {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId, deletedAt: null },
      include: { department: true },
    });

    if (!employee) {
      throw new AppError('Employee not found.', 404);
    }

    // Boundary check: HOD can only edit employees in their own department
    if (actor.role === UserRole.HOD && employee.departmentId !== actor.departmentId) {
      throw new AppError('Access denied. You cannot modify employees from another department.', 403);
    }

    // Protection: HOD cannot edit themselves, another HOD, or an Administrator
    if (actor.role === UserRole.HOD) {
      if (employee.id === actor.id) {
        throw new AppError('You cannot modify your own profile through department management. Use Account Settings.', 403);
      }
      if (employee.role === UserRole.ADMIN || employee.role === UserRole.HOD) {
        throw new AppError('Access denied. You cannot modify administrative or HOD accounts.', 403);
      }
    }

    const updateData: any = {};
    const changes: string[] = [];

    if (data.firstName !== undefined && data.firstName.trim()) {
      updateData.firstName = data.firstName.trim();
      changes.push(`First Name: '${employee.firstName}' -> '${updateData.firstName}'`);
    }

    if (data.lastName !== undefined && data.lastName.trim()) {
      updateData.lastName = data.lastName.trim();
      changes.push(`Last Name: '${employee.lastName}' -> '${updateData.lastName}'`);
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone ? data.phone.trim().slice(0, 30) : null;
      changes.push(`Phone updated`);
    }

    if (changes.length === 0) {
      return employee;
    }

    const updated = await prisma.user.update({
      where: { id: employeeId },
      data: updateData,
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        departmentId: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'EMPLOYEE_UPDATED_BY_HOD',
        description: `Employee ${updated.firstName} ${updated.lastName} (${updated.email}) updated by ${actor.firstName} ${actor.lastName}: ${changes.join(', ')}.`,
      },
    });

    clearUserSessionCache(employeeId);
    return updated;
  }

  /**
   * Performs an impact assessment prior to deactivating an employee.
   */
  public static async checkEmployeeDeactivationImpact(
    actor: AuthContextUser,
    employeeId: string
  ) {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId, deletedAt: null },
      include: {
        assignedRequests: { where: { status: RequestStatus.IN_REVIEW } },
        requests: { where: { status: { in: [RequestStatus.IN_REVIEW, RequestStatus.DRAFT] } } },
        positionAssignments: { where: { endDate: null }, include: { position: true } },
      },
    });

    if (!employee) {
      throw new AppError('Employee not found.', 404);
    }

    if (actor.role === UserRole.HOD && employee.departmentId !== actor.departmentId) {
      throw new AppError('Access denied. You cannot inspect employees from another department.', 403);
    }

    const warnings: string[] = [];
    let canDeactivate = true;

    if (employee.id === actor.id) {
      warnings.push('You cannot deactivate your own account.');
      canDeactivate = false;
    }

    if (employee.role === UserRole.ADMIN) {
      warnings.push('Administrator accounts cannot be deactivated by an HOD.');
      canDeactivate = false;
    }

    if (employee.role === UserRole.HOD) {
      warnings.push('Head of Department accounts can only be modified or reassigned by an Administrator.');
      canDeactivate = false;
    }

    const pendingAssignedCount = employee.assignedRequests.length;
    const openSubmittedCount = employee.requests.length;
    const activePositionsCount = employee.positionAssignments.length;

    if (pendingAssignedCount > 0) {
      warnings.push(`Employee currently has ${pendingAssignedCount} pending workflow approval(s) specifically assigned to them.`);
      if (actor.role !== UserRole.ADMIN) {
        canDeactivate = false;
      }
    }

    if (openSubmittedCount > 0) {
      warnings.push(`Employee has ${openSubmittedCount} active or in-review submitted request(s).`);
    }

    return {
      canDeactivate,
      pendingAssignedCount,
      openSubmittedCount,
      activePositionsCount,
      activePositions: employee.positionAssignments.map((a) => ({
        id: a.position.id,
        name: a.position.name,
        type: a.assignmentType,
      })),
      warnings,
    };
  }

  /**
   * Deactivates an employee with safeguards.
   */
  public static async deactivateDepartmentEmployee(
    actor: AuthContextUser,
    employeeId: string,
    options?: { isOverride?: boolean; overrideReason?: string }
  ) {
    const assessment = await this.checkEmployeeDeactivationImpact(actor, employeeId);

    if (!assessment.canDeactivate && !options?.isOverride) {
      throw new AppError(
        assessment.warnings.join(' ') || 'Cannot deactivate employee due to existing dependencies.',
        400
      );
    }

    if (options?.isOverride && actor.role !== UserRole.ADMIN) {
      throw new AppError('Administrative override is restricted to administrators.', 403);
    }

    if (options?.isOverride && (!options.overrideReason || !options.overrideReason.trim())) {
      throw new AppError('Administrative override requires a justification reason.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Soft deactivate user
      const updatedUser = await tx.user.update({
        where: { id: employeeId },
        data: {
          isActive: false,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
      });

      // 2. End all active position assignments
      await tx.employeePosition.updateMany({
        where: { userId: employeeId, endDate: null },
        data: {
          endDate: new Date(),
          endedById: actor.id,
        },
      });

      // 3. Log audit event
      const logAction = options?.isOverride ? 'ADMIN_OVERRIDE_EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_DEACTIVATED';
      const logDesc = options?.isOverride
        ? `[ADMIN OVERRIDE: ${options.overrideReason!.trim()}] Employee ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email}) deactivated by ${actor.firstName} ${actor.lastName}.`
        : `Employee ${updatedUser.firstName} ${updatedUser.lastName} (${updatedUser.email}) deactivated by ${actor.firstName} ${actor.lastName}.`;

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: logAction,
          description: logDesc,
        },
      });

      return updatedUser;
    }, { timeout: 20000, maxWait: 10000 });

    clearUserSessionCache(employeeId);
    return result;
  }

  // ==========================================
  // POSITION ASSIGNMENT & HISTORY
  // ==========================================

  /**
   * Assigns or changes an employee's hospital position transactionally.
   * - Ending previous PRIMARY assignment atomically.
   * - Preserving snapshot of positionNameAtTime.
   * - CRITICAL: Zero modification to User.role or permissions!
   */
  public static async assignEmployeePosition(
    actor: AuthContextUser,
    employeeId: string,
    data: {
      positionId: string;
      assignmentType?: PositionAssignmentType;
      startDate?: Date;
      endDate?: Date;
      reason?: string;
    }
  ) {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId, deletedAt: null },
      include: { department: true },
    });

    if (!employee) {
      throw new AppError('Employee not found.', 404);
    }

    if (actor.role === UserRole.HOD && employee.departmentId !== actor.departmentId) {
      throw new AppError('Access denied. You can only assign positions to employees in your department.', 403);
    }

    // Position check
    const position = await prisma.position.findUnique({
      where: { id: data.positionId },
    });

    if (!position || position.deletedAt !== null) {
      throw new AppError('Selected hospital position does not exist.', 404);
    }

    if (!position.isActive) {
      throw new AppError('Cannot assign an inactive hospital position.', 400);
    }

    if (position.departmentId !== employee.departmentId) {
      throw new AppError('Hospital position belongs to a different department.', 400);
    }

    const assignmentType = data.assignmentType || PositionAssignmentType.PRIMARY;

    // ACTING assignment requires an explicit end date
    if (assignmentType === PositionAssignmentType.ACTING) {
      if (!data.endDate) {
        throw new AppError('Acting position assignments require a designated end date.', 400);
      }
      if (new Date(data.endDate) <= new Date(data.startDate || Date.now())) {
        throw new AppError('Acting position end date must be after start date.', 400);
      }
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const reasonClean = data.reason?.trim() || null;

    const result = await prisma.$transaction(async (tx) => {
      let previousPositionName = 'None';

      // If PRIMARY assignment, end any existing active PRIMARY assignment
      if (assignmentType === PositionAssignmentType.PRIMARY) {
        const currentPrimary = await tx.employeePosition.findFirst({
          where: {
            userId: employeeId,
            assignmentType: PositionAssignmentType.PRIMARY,
            endDate: null,
          },
          include: { position: true },
        });

        if (currentPrimary) {
          previousPositionName = currentPrimary.positionNameAtTime || currentPrimary.position.name;
          await tx.employeePosition.update({
            where: { id: currentPrimary.id },
            data: {
              endDate: startDate,
              endedById: actor.id,
            },
          });
        }
      }

      // Create new position assignment with snapshot of position name
      const newAssignment = await tx.employeePosition.create({
        data: {
          userId: employeeId,
          positionId: position.id,
          assignmentType,
          startDate,
          endDate: data.endDate ? new Date(data.endDate) : null,
          reason: reasonClean,
          positionNameAtTime: position.name,
          createdById: actor.id,
        },
        include: {
          position: true,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'EMPLOYEE_POSITION_CHANGED',
          description: `Hospital position for ${employee.firstName} ${employee.lastName} (${employee.email}) updated from '${previousPositionName}' to '${position.name}' (${assignmentType})${reasonClean ? `. Reason: ${reasonClean}` : ''} by ${actor.firstName} ${actor.lastName}.`,
        },
      });

      return newAssignment;
    }, { timeout: 20000, maxWait: 10000 });

    return result;
  }

  /**
   * Retrieves full chronological position history for an employee.
   */
  public static async getEmployeePositionHistory(
    actor: AuthContextUser,
    employeeId: string
  ) {
    const employee = await prisma.user.findUnique({
      where: { id: employeeId, deletedAt: null },
    });

    if (!employee) {
      throw new AppError('Employee not found.', 404);
    }

    if (actor.role === UserRole.HOD && employee.departmentId !== actor.departmentId) {
      throw new AppError('Access denied. You can only view position history for employees in your department.', 403);
    }

    const history = await prisma.employeePosition.findMany({
      where: { userId: employeeId },
      include: {
        position: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return {
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeId: employee.employeeId,
      },
      history: history.map((h) => ({
        id: h.id,
        positionId: h.positionId,
        positionName: h.positionNameAtTime || h.position.name,
        assignmentType: h.assignmentType,
        startDate: h.startDate,
        endDate: h.endDate,
        isActive: h.endDate === null || new Date(h.endDate) > new Date(),
        reason: h.reason,
        createdAt: h.createdAt,
      })),
    };
  }

  // ==========================================
  // DEPARTMENT POSITION MANAGEMENT
  // ==========================================

  /**
   * Retrieves department positions with active employee counts.
   */
  public static async getDepartmentPositions(
    actor: AuthContextUser,
    departmentId?: string,
    query?: { search?: string; isActive?: boolean }
  ) {
    const targetDeptId = this.resolveAuthorizedDepartmentId(actor, departmentId);

    const where: any = {
      departmentId: targetDeptId,
      deletedAt: null,
    };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const [positions, department] = await Promise.all([
      prisma.position.findMany({
        where,
        include: {
          assignments: {
            where: { endDate: null },
            select: { id: true, userId: true, assignmentType: true },
          },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.department.findUnique({
        where: { id: targetDeptId },
        select: { id: true, name: true, code: true, displayName: true },
      }),
    ]);

    const formattedPositions = positions.map((p) => {
      const activePrimaryCount = p.assignments.filter((a) => a.assignmentType === PositionAssignmentType.PRIMARY).length;
      const activeActingCount = p.assignments.filter((a) => a.assignmentType === PositionAssignmentType.ACTING).length;

      return {
        id: p.id,
        departmentId: p.departmentId,
        name: p.name,
        description: p.description,
        isActive: p.isActive,
        version: p.version,
        activeEmployeeCount: p.assignments.length,
        activePrimaryCount,
        activeActingCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    return {
      department,
      positions: formattedPositions,
    };
  }

  /**
   * Creates a new hospital position in a department.
   */
  public static async createPosition(
    actor: AuthContextUser,
    data: { name: string; description?: string; departmentId?: string }
  ) {
    const targetDeptId = this.resolveAuthorizedDepartmentId(actor, data.departmentId);

    if (!data.name || !data.name.trim()) {
      throw new AppError('Position name is required.', 400);
    }

    const cleanName = data.name.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      throw new AppError('Position name must be between 2 and 100 characters.', 400);
    }

    const normalizedName = cleanName.toLowerCase();

    // Check case-insensitive duplicate in this department
    const existing = await prisma.position.findUnique({
      where: {
        departmentId_normalizedName: {
          departmentId: targetDeptId,
          normalizedName,
        },
      },
    });

    if (existing) {
      if (existing.isActive) {
        throw new AppError(`A position named '${cleanName}' already exists in this department.`, 400);
      } else {
        // If inactive, offer to reactivate or reject
        throw new AppError(`A position named '${cleanName}' previously existed and is currently inactive. Please reactivate it instead.`, 400);
      }
    }

    // Informational security warning check (does not block, but surfaces in response)
    const sensitiveKeywords = ['admin', 'hod', 'director', 'approver', 'finance officer', 'procurement officer'];
    const keywordWarning = sensitiveKeywords.find((k) => normalizedName.includes(k))
      ? `Notice: This position title resembles an E-Office system role. Hospital positions are organizational job titles only and do not grant system privileges or workflow authority.`
      : null;

    const newPosition = await prisma.position.create({
      data: {
        departmentId: targetDeptId,
        name: cleanName,
        normalizedName,
        description: data.description?.trim() || null,
        isActive: true,
        version: 1,
        createdById: actor.id,
      },
      select: {
        id: true,
        departmentId: true,
        name: true,
        description: true,
        isActive: true,
        version: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'POSITION_CREATED',
        description: `Hospital position '${newPosition.name}' created in department by ${actor.firstName} ${actor.lastName}.`,
      },
    });

    return {
      position: newPosition,
      warning: keywordWarning,
    };
  }

  /**
   * Updates a position with optimistic locking.
   */
  public static async updatePosition(
    actor: AuthContextUser,
    positionId: string,
    data: { name?: string; description?: string; version?: number }
  ) {
    const position = await prisma.position.findUnique({
      where: { id: positionId, deletedAt: null },
    });

    if (!position) {
      throw new AppError('Hospital position not found.', 404);
    }

    // Scoping check
    if (actor.role === UserRole.HOD && position.departmentId !== actor.departmentId) {
      throw new AppError('Access denied. You cannot modify positions in another department.', 403);
    }

    // Optimistic concurrency check
    if (data.version !== undefined && position.version !== data.version) {
      throw new AppError('Concurrent update conflict. Another user modified this position. Please refresh and try again.', 409);
    }

    const updateData: any = {
      version: { increment: 1 },
      updatedById: actor.id,
    };

    if (data.name !== undefined && data.name.trim()) {
      const cleanName = data.name.trim();
      const normalizedName = cleanName.toLowerCase();

      if (normalizedName !== position.normalizedName) {
        const existing = await prisma.position.findUnique({
          where: {
            departmentId_normalizedName: {
              departmentId: position.departmentId,
              normalizedName,
            },
          },
        });
        if (existing && existing.id !== positionId) {
          throw new AppError(`Another position named '${cleanName}' already exists in this department.`, 400);
        }
        updateData.name = cleanName;
        updateData.normalizedName = normalizedName;
      }
    }

    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }

    const updated = await prisma.position.update({
      where: { id: positionId },
      data: updateData,
      select: {
        id: true,
        departmentId: true,
        name: true,
        description: true,
        isActive: true,
        version: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'POSITION_UPDATED',
        description: `Position '${position.name}' updated (new name: '${updated.name}') by ${actor.firstName} ${actor.lastName}.`,
      },
    });

    return updated;
  }

  /**
   * Deactivates a position with active assignment guards.
   */
  public static async deactivatePosition(
    actor: AuthContextUser,
    positionId: string,
    options?: { isOverride?: boolean; overrideReason?: string }
  ) {
    const position = await prisma.position.findUnique({
      where: { id: positionId, deletedAt: null },
      include: {
        assignments: {
          where: { endDate: null },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });

    if (!position) {
      throw new AppError('Hospital position not found.', 404);
    }

    if (actor.role === UserRole.HOD && position.departmentId !== actor.departmentId) {
      throw new AppError('Access denied. You cannot deactivate positions in another department.', 403);
    }

    const activeCount = position.assignments.length;

    if (activeCount > 0 && !options?.isOverride) {
      throw new AppError(
        `Cannot deactivate position '${position.name}': ${activeCount} active employee(s) are currently assigned to it. Reassign employees before deactivating.`,
        400
      );
    }

    if (options?.isOverride && actor.role !== UserRole.ADMIN) {
      throw new AppError('Administrative override is restricted to administrators.', 403);
    }

    if (options?.isOverride && (!options.overrideReason || !options.overrideReason.trim())) {
      throw new AppError('Administrative override requires a justification reason.', 400);
    }

    const updated = await prisma.position.update({
      where: { id: positionId },
      data: {
        isActive: false,
        updatedById: actor.id,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        updatedAt: true,
      },
    });

    const auditAction = options?.isOverride ? 'ADMIN_OVERRIDE_POSITION_DEACTIVATED' : 'POSITION_DEACTIVATED';
    const auditDesc = options?.isOverride
      ? `[ADMIN OVERRIDE: ${options.overrideReason!.trim()}] Position '${position.name}' deactivated by ${actor.firstName} ${actor.lastName}. (${activeCount} active assignments affected).`
      : `Position '${position.name}' deactivated by ${actor.firstName} ${actor.lastName}.`;

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: auditAction,
        description: auditDesc,
      },
    });

    return updated;
  }

  // ==========================================
  // ADMIN OVERSIGHT
  // ==========================================

  /**
   * Retrieves organization-wide overview of departments, employee counts, and active positions.
   */
  public static async getAdminDepartmentOverview() {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            employeeId: true,
          },
        },
        users: {
          where: { deletedAt: null },
          select: { id: true, isActive: true },
        },
        positions: {
          where: { deletedAt: null, isActive: true },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return departments.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      displayName: d.displayName || d.name,
      isActive: d.isActive,
      hod: d.hod,
      totalEmployees: d.users.length,
      activeEmployees: d.users.filter((u) => u.isActive).length,
      inactiveEmployees: d.users.filter((u) => !u.isActive).length,
      activePositionsCount: d.positions.length,
    }));
  }

  /**
   * Retrieves organization-wide list of positions across all departments.
   */
  public static async getAllPositions(query?: {
    search?: string;
    departmentId?: string;
    isActive?: boolean;
  }) {
    const where: any = { deletedAt: null };

    if (query?.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const positions = await prisma.position.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
          },
        },
        assignments: {
          where: { endDate: null },
          select: { id: true },
        },
      },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    });

    return positions.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      departmentId: p.departmentId,
      departmentName: p.department.displayName || p.department.name,
      departmentCode: p.department.code,
      isActive: p.isActive,
      activeEmployeeCount: p.assignments.length,
      version: p.version,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }
}

