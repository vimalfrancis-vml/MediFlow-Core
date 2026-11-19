import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { DepartmentManagementService } from '../../src/services/department-management.service';
import { UserRole, PositionAssignmentType, RequestStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('HOD Department User & Position Management System', { timeout: 30000 }, () => {
  let cardioDept: any;
  let itDept: any;
  let cardioHod: any;
  let itHod: any;
  let adminUser: any;
  let testEmployee: any;
  let cardioPosition: any;
  let seniorCardioPosition: any;

  beforeAll(async () => {
    // 1. Fetch or create test departments with retry for cloud DB cold start
    let retries = 5;
    while (retries > 0) {
      try {
        cardioDept = await prisma.department.findUnique({ where: { code: 'CARD' } });
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    itDept = await prisma.department.findUnique({ where: { code: 'IT' } });

    if (!cardioDept) {
      cardioDept = await prisma.department.create({
        data: { code: 'CARD', name: 'Cardiology' },
      });
    }
    if (!itDept) {
      itDept = await prisma.department.create({
        data: { code: 'IT', name: 'Information Technology' },
      });
    }

    // 2. Fetch or create HODs and Admin
    cardioHod = await prisma.user.findFirst({
      where: { role: UserRole.HOD, departmentId: cardioDept.id, isActive: true },
    });
    if (!cardioHod) {
      const hash = await bcrypt.hash('TestPass123!@#', 10);
      cardioHod = await prisma.user.create({
        data: {
          email: `hod.cardio.${Date.now()}@eoffice.org`,
          employeeId: `HOD-C-${Date.now().toString().slice(-4)}`,
          firstName: 'Cardio',
          lastName: 'HOD',
          role: UserRole.HOD,
          departmentId: cardioDept.id,
          passwordHash: hash,
        },
      });
    }

    itHod = await prisma.user.findFirst({
      where: { role: UserRole.HOD, departmentId: itDept.id, isActive: true },
    });
    if (!itHod) {
      const hash = await bcrypt.hash('TestPass123!@#', 10);
      itHod = await prisma.user.create({
        data: {
          email: `hod.it.${Date.now()}@eoffice.org`,
          employeeId: `HOD-IT-${Date.now().toString().slice(-4)}`,
          firstName: 'IT',
          lastName: 'HOD',
          role: UserRole.HOD,
          departmentId: itDept.id,
          passwordHash: hash,
        },
      });
    }

    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
    });
    if (!adminUser) {
      const hash = await bcrypt.hash('AdminPass123!@#', 10);
      adminUser = await prisma.user.create({
        data: {
          email: `admin.${Date.now()}@eoffice.org`,
          employeeId: `ADM-${Date.now().toString().slice(-4)}`,
          firstName: 'Admin',
          lastName: 'Super',
          role: UserRole.ADMIN,
          departmentId: cardioDept.id,
          passwordHash: hash,
        },
      });
    }
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testEmployee?.id) {
      await prisma.employeePosition.deleteMany({ where: { userId: testEmployee.id } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { actorId: testEmployee.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testEmployee.id } }).catch(() => {});
    }
    if (cardioPosition?.id) {
      await prisma.employeePosition.deleteMany({ where: { positionId: cardioPosition.id } }).catch(() => {});
      await prisma.position.delete({ where: { id: cardioPosition.id } }).catch(() => {});
    }
    if (seniorCardioPosition?.id) {
      await prisma.employeePosition.deleteMany({ where: { positionId: seniorCardioPosition.id } }).catch(() => {});
      await prisma.position.delete({ where: { id: seniorCardioPosition.id } }).catch(() => {});
    }
  });

  describe('1. Position Management & Uniqueness Constraints', () => {
    it('allows an HOD to create a hospital position in their department', async () => {
      const res = await DepartmentManagementService.createPosition(cardioHod, {
        name: 'Staff Nurse',
        description: 'Regular nursing staff in Cardiology Ward',
      });

      cardioPosition = res.position;
      expect(cardioPosition).toBeDefined();
      expect(cardioPosition.name).toBe('Staff Nurse');
      expect(cardioPosition.departmentId).toBe(cardioDept.id);
      expect(cardioPosition.isActive).toBe(true);
      expect(cardioPosition.version).toBe(1);
    });

    it('rejects duplicate position names in the same department (case-insensitive)', async () => {
      await expect(
        DepartmentManagementService.createPosition(cardioHod, {
          name: 'staff nurse', // lowercase variant
        })
      ).rejects.toThrow('already exists in this department');
    });

    it('allows the same position name in a different department', async () => {
      const itPos = await DepartmentManagementService.createPosition(itHod, {
        name: 'Staff Nurse', // same name in IT
      });

      expect(itPos.position.name).toBe('Staff Nurse');
      expect(itPos.position.departmentId).toBe(itDept.id);

      // Clean up
      await prisma.position.delete({ where: { id: itPos.position.id } });
    });

    it('returns a warning when position name resembles an administrative role', async () => {
      const res = await DepartmentManagementService.createPosition(cardioHod, {
        name: 'Junior Administrator',
      });

      expect(res.position).toBeDefined();
      expect(res.warning).toContain('resembles an E-Office system role');

      await prisma.position.delete({ where: { id: res.position.id } });
    });

    it('prevents HOD from creating positions in another department', async () => {
      await expect(
        DepartmentManagementService.createPosition(cardioHod, {
          name: 'Network Engineer',
          departmentId: itDept.id, // trying to create in IT
        })
      ).rejects.toThrow('Access denied. You can only manage your own department');
    });

    it('supports optimistic locking when updating position', async () => {
      // Create second position for concurrency test
      const res = await DepartmentManagementService.createPosition(cardioHod, {
        name: 'Senior Nurse',
      });
      seniorCardioPosition = res.position;

      // Updating with correct version succeeds
      const updated = await DepartmentManagementService.updatePosition(cardioHod, seniorCardioPosition.id, {
        description: 'Updated nursing description',
        version: 1,
      });
      expect(updated.version).toBe(2);

      // Updating with stale version fails with 409 conflict
      await expect(
        DepartmentManagementService.updatePosition(cardioHod, seniorCardioPosition.id, {
          description: 'Conflict update',
          version: 1, // stale version
        })
      ).rejects.toThrow('Concurrent update conflict');
    });
  });

  describe('2. Department Employee Creation & Initial Placement', () => {
    it('creates an employee strictly with EMPLOYEE system role and temporary credentials', async () => {
      const email = `nurse.${Date.now()}@eoffice.org`;
      const empId = `NUR-${Date.now().toString().slice(-4)}`;

      const res = await DepartmentManagementService.createDepartmentEmployee(cardioHod, {
        employeeId: empId,
        email,
        firstName: 'Florence',
        lastName: 'Nightingale',
        phone: '+91 98765 11111',
        positionId: cardioPosition.id,
      });

      testEmployee = res.user;
      expect(testEmployee.role).toBe(UserRole.EMPLOYEE); // Guaranteed role
      expect(testEmployee.departmentId).toBe(cardioDept.id);
      expect(testEmployee.mustChangePassword).toBe(true);
      expect(res.temporaryPassword).toBeDefined();
      expect(res.assignedPosition?.name).toBe('Staff Nurse');

      // Verify position assignment record
      const assignment = await prisma.employeePosition.findFirst({
        where: { userId: testEmployee.id, positionId: cardioPosition.id },
      });
      expect(assignment?.assignmentType).toBe(PositionAssignmentType.PRIMARY);
      expect(assignment?.positionNameAtTime).toBe('Staff Nurse');
      expect(assignment?.endDate).toBeNull();
    });

    it('prevents HOD from creating employees in another department', async () => {
      await expect(
        DepartmentManagementService.createDepartmentEmployee(cardioHod, {
          employeeId: `INV-${Date.now().toString().slice(-4)}`,
          email: `invalid.${Date.now()}@eoffice.org`,
          firstName: 'Intruder',
          lastName: 'User',
          departmentId: itDept.id, // Cardio HOD trying to insert into IT
        })
      ).rejects.toThrow('Access denied. You can only manage your own department');
    });
  });

  describe('3. Position Changes & Atomic History Preservation', () => {
    it('ends previous PRIMARY position atomically when assigning a new PRIMARY position', async () => {
      // Promote from 'Staff Nurse' to 'Senior Nurse'
      const newAssignment = await DepartmentManagementService.assignEmployeePosition(cardioHod, testEmployee.id, {
        positionId: seniorCardioPosition.id,
        assignmentType: PositionAssignmentType.PRIMARY,
        reason: 'Promotion for exemplary patient care',
      });

      expect(newAssignment.assignmentType).toBe(PositionAssignmentType.PRIMARY);
      expect(newAssignment.position.name).toBe('Senior Nurse');

      // Verify old PRIMARY assignment was ended
      const oldAssignment = await prisma.employeePosition.findFirst({
        where: { userId: testEmployee.id, positionId: cardioPosition.id },
      });
      expect(oldAssignment?.endDate).not.toBeNull();
      expect(oldAssignment?.endedById).toBe(cardioHod.id);
      expect(oldAssignment?.positionNameAtTime).toBe('Staff Nurse');

      // Verify user's system role remains EMPLOYEE
      const empUser = await prisma.user.findUnique({ where: { id: testEmployee.id } });
      expect(empUser?.role).toBe(UserRole.EMPLOYEE);
    });

    it('preserves historical position name snapshot even after position is renamed', async () => {
      // Rename 'Staff Nurse' position to unique name
      const renamedTitle = `Registered Nurse ${Date.now()}`;
      await DepartmentManagementService.updatePosition(cardioHod, cardioPosition.id, {
        name: renamedTitle,
      });

      // The historical assignment record must still say 'Staff Nurse'
      const historicalRecord = await prisma.employeePosition.findFirst({
        where: { userId: testEmployee.id, positionId: cardioPosition.id },
      });
      expect(historicalRecord?.positionNameAtTime).toBe('Staff Nurse');
    });

    it('requires an end date for ACTING position assignments', async () => {
      await expect(
        DepartmentManagementService.assignEmployeePosition(cardioHod, testEmployee.id, {
          positionId: cardioPosition.id,
          assignmentType: PositionAssignmentType.ACTING,
          // Missing endDate
        })
      ).rejects.toThrow('Acting position assignments require a designated end date');
    });

    it('rejects assigning a position that belongs to another department', async () => {
      // Create IT position
      const itPos = await DepartmentManagementService.createPosition(itHod, {
        name: 'Sysadmin',
      });

      // Cardio HOD assigning IT position to Cardio employee must fail
      await expect(
        DepartmentManagementService.assignEmployeePosition(cardioHod, testEmployee.id, {
          positionId: itPos.position.id,
        })
      ).rejects.toThrow('Hospital position belongs to a different department');

      await prisma.position.delete({ where: { id: itPos.position.id } });
    });
  });

  describe('4. Safeguards on Deactivation & Cross-Department Access', () => {
    it('prevents deactivating a position that currently has active employee assignments', async () => {
      // seniorCardioPosition is currently active on testEmployee
      await expect(
        DepartmentManagementService.deactivatePosition(cardioHod, seniorCardioPosition.id)
      ).rejects.toThrow('Cannot deactivate position');
    });

    it('allows deactivating a position once employees are reassigned or have no assignments', async () => {
      // cardioPosition currently has 0 active assignments (it was ended)
      const res = await DepartmentManagementService.deactivatePosition(cardioHod, cardioPosition.id);
      expect(res.isActive).toBe(false);
    });

    it('prevents an HOD from modifying an employee in another department', async () => {
      await expect(
        DepartmentManagementService.updateDepartmentEmployee(itHod, testEmployee.id, {
          firstName: 'Hacked',
        })
      ).rejects.toThrow('Access denied');
    });

    it('prevents an HOD from deactivating an employee in another department', async () => {
      await expect(
        DepartmentManagementService.deactivateDepartmentEmployee(itHod, testEmployee.id)
      ).rejects.toThrow('Access denied');
    });

    it('prevents an HOD from deactivating themselves or an Administrator', async () => {
      await expect(
        DepartmentManagementService.deactivateDepartmentEmployee(cardioHod, cardioHod.id)
      ).rejects.toThrow('You cannot deactivate your own account');

      await expect(
        DepartmentManagementService.deactivateDepartmentEmployee(cardioHod, adminUser.id)
      ).rejects.toThrow('Access denied');
    });
  });
});
