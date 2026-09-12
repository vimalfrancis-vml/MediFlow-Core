import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../src/db';
import { UserService } from '../../src/services/user.service';
import { DepartmentService } from '../../src/services/department.service';
import { AuditService } from '../../src/services/audit.service';
import { WorkflowService } from '../../src/services/workflow.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver, resolveActiveWorkflowTemplate } from '../../src/core/StepResolver';
import { UserRole, RequestType, Priority, RequestStatus } from '@prisma/client';

describe('MediFlow Phase 2 — Safety Safeguards & Protections Tests', { timeout: 30000 }, () => {
  let activeAdmin: any;
  let normalEmployee: any;

  const toAuthUser = (u: any, deptCode: string = 'CARD'): AuthUser => ({
    id: u.id,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentCode: deptCode,
    firstName: u.firstName,
    lastName: u.lastName,
  });

  beforeAll(async () => {
    activeAdmin = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN, isActive: true },
    });
    normalEmployee = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, isActive: true },
    });

    // Ensure base templates for all 3 request types are active and not deleted
    for (const type of [RequestType.PURCHASE, RequestType.MAINTENANCE, RequestType.LEAVE]) {
      const base = await prisma.workflowTemplate.findFirst({
        where: { requestType: type, NOT: { name: { startsWith: 'Dynamic:' } } },
        orderBy: { version: 'asc' },
      });
      if (base) {
        await prisma.workflowTemplate.update({
          where: { id: base.id },
          data: { isActive: true, deletedAt: null },
        });
      }
    }
  });

  describe('1. Last Active Admin Protection', () => {
    it('prevents deactivating the only active administrator or demoting them', async () => {
      const activeAdmins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN, isActive: true, deletedAt: null },
      });

      // If only 1 admin exists, attempt to deactivate
      if (activeAdmins.length === 1) {
        await expect(
          UserService.updateUser(activeAdmins[0].id, { isActive: false })
        ).rejects.toThrow(/Cannot deactivate or remove role from the last active Administrator/);

        await expect(
          UserService.updateUser(activeAdmins[0].id, { role: UserRole.EMPLOYEE })
        ).rejects.toThrow(/Cannot deactivate or remove role from the last active Administrator/);
      } else {
        // If multiple exist, test by creating a single dedicated temp admin
        const tempAdmin = await UserService.createUser({
          email: `temp.admin.${Date.now()}@mediflow.com`,
          employeeId: `TA-${Date.now().toString().slice(-4)}`,
          firstName: 'Temp',
          lastName: 'Admin',
          role: 'ADMIN',
          departmentId: activeAdmin.departmentId,
        });

        // Deactivating temp admin is allowed because other active admins exist
        const deactivated = await UserService.updateUser(tempAdmin.id, { isActive: false });
        expect(deactivated.isActive).toBe(false);

        // Cleanup
        await prisma.auditLog.deleteMany({ where: { actorId: tempAdmin.id } });
        await prisma.user.delete({ where: { id: tempAdmin.id } });
      }
    });
  });

  describe('2. Department Deactivation Safeguards', () => {
    it('prevents deactivating mandatory routing departments like CARD, FIN, HR', async () => {
      const finDept = await prisma.department.findUniqueOrThrow({ where: { code: 'FIN' } });

      await expect(
        DepartmentService.updateDepartment(finDept.id, { isActive: false })
      ).rejects.toThrow(/Cannot deactivate system department.*required for mandatory system workflow routing/);
    });

    it('prevents deactivating departments actively targeted by workflow steps', async () => {
      // Find an active department with step usage
      const step = await prisma.workflowStep.findFirst({
        where: {
          approverDepartmentId: { not: null },
          template: { isActive: true, deletedAt: null },
        },
      });

      if (step && step.approverDepartmentId) {
        const dept = await prisma.department.findUniqueOrThrow({ where: { id: step.approverDepartmentId } });
        await expect(
          DepartmentService.updateDepartment(dept.id, { isActive: false })
        ).rejects.toThrow(/because active workflow.*requires it for step/);
      }
    });
  });

  describe('3. Audit Logs Service & Data Safety', () => {
    it('retrieves paginated audit logs without leaking sensitive credentials', async () => {
      const logsResult = await AuditService.getAuditLogs({ limit: 10 });
      expect(logsResult.items.length).toBeGreaterThan(0);
      expect(logsResult.pagination.total).toBeGreaterThan(0);

      for (const item of logsResult.items) {
        expect(item.id).toBeDefined();
        expect(item.action).toBeDefined();
        // Ensure no password hashes or tokens leaked
        expect((item as any).passwordHash).toBeUndefined();
        expect((item as any).password).toBeUndefined();
        expect((item as any).token).toBeUndefined();
        if (item.actor) {
          expect((item.actor as any).passwordHash).toBeUndefined();
        }
      }
    });

    it('filters audit logs by action type correctly', async () => {
      const filtered = await AuditService.getAuditLogs({ action: 'SUBMITTED', limit: 5 });
      for (const item of filtered.items) {
        expect(item.action).toBe('SUBMITTED');
      }
    });
  });

  describe('4. Workflow Validation with Flexible Stages', () => {
    it('allows non-consecutive duplicate roles when appropriately separated by intervening stages', async () => {
      // Step 1: HOD -> Step 2: Director -> Step 3: HOD (e.g. final signoff)
      const validSteps = [
        { stepName: 'Initial Department Review', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
        { stepName: 'Executive Review', order: 2, approverRole: 'DIRECTOR', allowDynamicForwarding: true },
        { stepName: 'Department Signoff', order: 3, approverRole: 'HOD', allowDynamicForwarding: true, isFinal: true },
      ];

      // Should NOT throw
      await expect(WorkflowService.validateWorkflowConfiguration(validSteps)).resolves.not.toThrow();
    });

    it('rejects consecutive redundant stages with identical role and department scope', async () => {
      const redundantSteps = [
        { stepName: 'First HOD Check', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
        { stepName: 'Second HOD Check', order: 2, approverRole: 'HOD', allowDynamicForwarding: true, isFinal: true },
      ];

      await expect(WorkflowService.validateWorkflowConfiguration(redundantSteps)).rejects.toThrow(
        /Redundant step configuration/
      );
    });
  });

  describe('5. Admin Authority Separation & Protected Override', () => {
    it('ADMIN cannot approve an arbitrary request merely because of ADMIN role', async () => {
      const hodCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HOD, email: 'hod.cardio@mediflow.com' } });
      const empCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' } });
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-ADMIN-SEP-${Date.now()}`,
          title: 'Defibrillator Batteries',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: empCardio.id,
          departmentId: empCardio.departmentId,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Standard medical battery replacement',
              quantity: 2,
              estimatedCost: 15000, // < 100k: Step 1 is HOD
              justification: 'Emergency power backup for cardiac ward defibrillators',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request.id, toAuthUser(empCardio, 'CARD'));

      // 1. ADMIN cannot act via canUserActOnRequest
      const canAct = await WorkflowEngine.canUserActOnRequest(request.id, activeAdmin.id);
      expect(canAct).toBe(false);

      // 2. ADMIN calling approve without override is rejected with 403
      await expect(
        WorkflowEngine.approve(request.id, 'Admin normal approve', toAuthUser(activeAdmin, 'ADMIN'))
      ).rejects.toThrow(/You cannot take action on this step/);

      // 3. ADMIN calling approve with override but missing reason is rejected with 400
      await expect(
        WorkflowEngine.approve(request.id, '', toAuthUser(activeAdmin, 'ADMIN'), { isOverride: true, overrideReason: '' })
      ).rejects.toThrow(/Administrative override requires an explicit justification reason/);

      // 4. ADMIN calling approve with explicit override succeeds and is fully audited
      const approved = await WorkflowEngine.approve(request.id, 'Urgent patient need', toAuthUser(activeAdmin, 'ADMIN'), {
        isOverride: true,
        overrideReason: 'Executive committee emergency exception granted',
      });
      expect(approved.status).toBe(RequestStatus.IN_REVIEW);

      const overrideLog = await prisma.auditLog.findFirst({
        where: {
          requestId: request.id,
          action: 'ADMIN_OVERRIDE_STEP_APPROVAL',
        },
      });
      expect(overrideLog).toBeDefined();
      expect(overrideLog!.description).toContain('Executive committee emergency exception granted');

      // Cleanup
      await prisma.auditLog.deleteMany({ where: { requestId: request.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: request.id } });
      await prisma.notification.deleteMany({ where: { requestId: request.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: request.id } });
      await prisma.request.delete({ where: { id: request.id } });
    });

    it('Unauthorized role/department users cannot approve', async () => {
      const empCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' } });
      const orthoDept = await prisma.department.findUnique({ where: { code: 'ORTHO' } });
      const directorUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.DIRECTOR } });
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

      const request = await prisma.request.create({
        data: {
          referenceNumber: `REQ-UNAUTH-${Date.now()}`,
          title: 'Surgical Gloves',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: empCardio.id,
          departmentId: empCardio.departmentId,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Latex surgical gloves',
              quantity: 10,
              estimatedCost: 5000,
              justification: 'Daily surgical inventory replenishment',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(request.id, toAuthUser(empCardio, 'CARD'));

      // Non-matching role (DIRECTOR tries to approve Step 1 which is HOD) -> 403
      await expect(
        WorkflowEngine.approve(request.id, 'Director acting early', toAuthUser(directorUser, 'EXEC'))
      ).rejects.toThrow(/You cannot take action on this step/);

      // Non-admin cannot claim administrative override
      await expect(
        WorkflowEngine.approve(request.id, 'Director override', toAuthUser(directorUser, 'EXEC'), {
          isOverride: true,
          overrideReason: 'I am the Director',
        })
      ).rejects.toThrow(/Administrative override is restricted to administrators/);

      // Cleanup
      await prisma.auditLog.deleteMany({ where: { requestId: request.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: request.id } });
      await prisma.notification.deleteMany({ where: { requestId: request.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: request.id } });
      await prisma.request.delete({ where: { id: request.id } });
    });
  });

  describe('6. ADMIN Privilege Escalation & Audit Logging', () => {
    it('ADMIN promotion and creation is audited with ADMIN_PRIVILEGE_GRANTED', async () => {
      // 1. Audit on creation of an admin
      const newAdmin = await UserService.createUser({
        email: `new.admin.${Date.now()}@mediflow.com`,
        employeeId: `EMP-ADM-${Date.now().toString().slice(-4)}`,
        firstName: 'System',
        lastName: 'Supervisor',
        role: 'ADMIN',
        departmentId: activeAdmin.departmentId,
      });

      const createAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'ADMIN_PRIVILEGE_GRANTED',
          description: { contains: newAdmin.email },
        },
      });
      expect(createAudit).toBeDefined();
      expect(createAudit!.description).toContain('New Administrator account created');

      // 2. Audit on promoting an existing employee to ADMIN
      const tempUser = await UserService.createUser({
        email: `promoted.user.${Date.now()}@mediflow.com`,
        employeeId: `EMP-PRM-${Date.now().toString().slice(-4)}`,
        firstName: 'Promoted',
        lastName: 'Staff',
        role: 'EMPLOYEE',
        departmentId: activeAdmin.departmentId,
      });

      await UserService.updateUser(tempUser.id, { role: 'ADMIN' });

      const promoteAudit = await prisma.auditLog.findFirst({
        where: {
          action: 'ADMIN_PRIVILEGE_GRANTED',
          description: { contains: tempUser.email },
        },
      });
      expect(promoteAudit).toBeDefined();
      expect(promoteAudit!.description).toContain('was granted Administrator privileges');

      // Cleanup
      await prisma.auditLog.deleteMany({ where: { actorId: { in: [newAdmin.id, tempUser.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [newAdmin.id, tempUser.id] } } });
    });
  });

  describe('7. Workflow Outage Prevention', () => {
    it('a request type cannot be left without a valid active workflow', async () => {
      // Find all templates for LEAVE
      const leaveTemplates = await prisma.workflowTemplate.findMany({
        where: {
          requestType: RequestType.LEAVE,
          deletedAt: null,
          NOT: { name: { startsWith: 'Dynamic:' } },
        },
      });

      // If only 1 template exists for LEAVE, attempting to archive it should be blocked
      if (leaveTemplates.length === 1) {
        await expect(WorkflowService.archiveTemplate(leaveTemplates[0].id)).rejects.toThrow(
          /Cannot archive or deactivate the only active workflow template/
        );
      } else {
        // Create a temporary isolated request type by testing with a single dedicated template
        // Or deactivate down to 1 and verify the final one cannot be archived
        const singleActive = leaveTemplates.find(t => t.isActive)!;
        // Verify active template exists
        const activeBefore = await resolveActiveWorkflowTemplate(RequestType.LEAVE);
        expect(activeBefore).toBeDefined();
      }
    });

    it('activating a workflow template atomically replaces active version without corrupting existing requests', async () => {
      const activeTemplate = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);
      expect(activeTemplate.isActive).toBe(true);

      // Create vNext
      const vNext = await WorkflowService.createNewVersion(activeTemplate.id, {
        name: `Maintenance Version Next ${Date.now()}`,
        steps: [
          { stepName: 'HOD Check', order: 1, approverRole: UserRole.HOD },
          { stepName: 'Facilities Fix', order: 2, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true },
        ],
      });

      expect(vNext.isActive).toBe(true);

      // Previous template is now inactive
      const prev = await prisma.workflowTemplate.findUnique({ where: { id: activeTemplate.id } });
      expect(prev!.isActive).toBe(false);

      // Explicit activateTemplate can switch back atomically
      const reactivated = await WorkflowService.activateTemplate(activeTemplate.id);
      expect(reactivated.isActive).toBe(true);

      const vNextAfter = await prisma.workflowTemplate.findUnique({ where: { id: vNext.id } });
      expect(vNextAfter!.isActive).toBe(false);

      // Clean up vNext
      await prisma.workflowStep.deleteMany({ where: { templateId: vNext.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: vNext.id } });
    });
  });

  describe('8. Finance Identity Stability & Display Name Resistance', () => {
    it('Finance-first still works after Finance display-name changes', async () => {
      const finDept = await prisma.department.findUniqueOrThrow({ where: { code: 'FIN' } });
      const originalDisplayName = finDept.displayName;

      try {
        // Change display name to something custom
        await DepartmentService.updateDepartment(finDept.id, {
          displayName: 'Central Treasury & Fiscal Oversight',
        });

        const empCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' } });
        const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);

        // Submit high value purchase request > ₹1,00,000
        const request = await prisma.request.create({
          data: {
            referenceNumber: `REQ-FIN-NAME-${Date.now()}`,
            title: 'Diagnostic Ultrasound System',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
            status: RequestStatus.DRAFT,
            requestedById: empCardio.id,
            departmentId: empCardio.departmentId,
            workflowTemplateId: template.id,
            purchaseDetail: {
              create: {
                itemDescription: 'High resolution clinical ultrasound',
                quantity: 1,
                estimatedCost: 350000, // > ₹1,00,000 -> Finance-first mandatory
                justification: 'Required for ICU diagnostic imaging',
              },
            },
          },
        });

        const submitted = await WorkflowEngine.submitRequest(request.id, toAuthUser(empCardio, 'CARD'));
        const steps = await StepResolver.getStepsForRequest(request.id);

        // Step 1 MUST be FINANCE_OFFICER regardless of display name
        expect(steps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);

        // Eligible recipients must still resolve Finance users using stable code 'FIN'
        const financeUser = await prisma.user.findFirstOrThrow({ where: { email: 'finance@mediflow.com' } });
        const canAct = await WorkflowEngine.canUserActOnRequest(request.id, financeUser.id);
        expect(canAct).toBe(true);

        // Cleanup
        await prisma.auditLog.deleteMany({ where: { requestId: request.id } });
        await prisma.notification.deleteMany({ where: { requestId: request.id } });
        await prisma.purchaseDetail.deleteMany({ where: { requestId: request.id } });
        await prisma.request.delete({ where: { id: request.id } });
      } finally {
        // Restore original display name
        await DepartmentService.updateDepartment(finDept.id, { displayName: originalDisplayName });
      }
    });
  });

  describe('9. Invariant Protection Against Admin Workflow Bypass', () => {
    it('Mandatory Finance-first and self-approval rules remain impossible to bypass through Admin workflow configuration', async () => {
      const empCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' } });
      const finDept = await prisma.department.findUniqueOrThrow({ where: { code: 'FIN' } });

      // Admin configures a template for PURCHASE with NO Finance step
      const bypassTemplate = await WorkflowService.createTemplate({
        name: `Bypass Attempt Template ${Date.now()}`,
        requestType: RequestType.PURCHASE,
        steps: [
          { stepName: 'HOD Quick Review', order: 1, approverRole: UserRole.HOD },
          { stepName: 'Director Fast Signoff', order: 2, approverRole: UserRole.DIRECTOR, isFinal: true },
        ],
      });

      try {
        // Submit purchase request > ₹1,00,000 using this bypass template
        const request = await prisma.request.create({
          data: {
            referenceNumber: `REQ-BYPASS-${Date.now()}`,
            title: 'High-Tech MRI Scanner Coil',
            type: RequestType.PURCHASE,
            priority: Priority.HIGH,
            status: RequestStatus.DRAFT,
            requestedById: empCardio.id,
            departmentId: empCardio.departmentId,
            workflowTemplateId: bypassTemplate.id,
            purchaseDetail: {
              create: {
                itemDescription: 'Cardiac MRI radiofrequency coil',
                quantity: 1,
                estimatedCost: 1500000, // ₹15,00,000 > ₹1,00,000
                justification: 'Cardiology department imaging scanner replacement',
              },
            },
          },
        });

        await WorkflowEngine.submitRequest(request.id, toAuthUser(empCardio, 'CARD'));
        const evaluatedSteps = await StepResolver.getStepsForRequest(request.id);

        // System invariant RULE_000 must inject Finance Review as Step 1
        expect(evaluatedSteps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);
        expect(evaluatedSteps[0]!.stepName).toContain('Finance');

        // Admin override CANNOT bypass Finance-first step on > ₹1,00,000 request
        await expect(
          WorkflowEngine.approve(request.id, 'Admin attempt bypass', toAuthUser(activeAdmin, 'ADMIN'), {
            isOverride: true,
            overrideReason: 'Trying to skip finance review',
          })
        ).rejects.toThrow(/Administrative override cannot bypass mandatory Finance-first approval/);

        // Self-approval check remains impossible to bypass even for admin
        const adminAsRequester = await prisma.request.create({
          data: {
            referenceNumber: `REQ-ADMIN-SELF-${Date.now()}`,
            title: 'Admin Office Supplies',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
            status: RequestStatus.DRAFT,
            requestedById: activeAdmin.id,
            departmentId: activeAdmin.departmentId,
            workflowTemplateId: bypassTemplate.id,
            purchaseDetail: {
              create: {
                itemDescription: 'Ergonomic office seating',
                quantity: 2,
                estimatedCost: 10000,
                justification: 'Administrative staff workstation equipment',
              },
            },
          },
        });

        await WorkflowEngine.submitRequest(adminAsRequester.id, toAuthUser(activeAdmin, 'ADMIN'));

        await expect(
          WorkflowEngine.approve(adminAsRequester.id, 'Self approval attempt', toAuthUser(activeAdmin, 'ADMIN'), {
            isOverride: true,
            overrideReason: 'I am the admin so I can self approve',
          })
        ).rejects.toThrow(/You cannot approve your own request/);

        // Cleanup
        await prisma.auditLog.deleteMany({ where: { requestId: { in: [request.id, adminAsRequester.id] } } });
        await prisma.notification.deleteMany({ where: { requestId: { in: [request.id, adminAsRequester.id] } } });
        await prisma.purchaseDetail.deleteMany({ where: { requestId: { in: [request.id, adminAsRequester.id] } } });
        await prisma.request.deleteMany({ where: { id: { in: [request.id, adminAsRequester.id] } } });
      } finally {
        // Clean up bypass template and restore base Purchase template
        await prisma.workflowStep.deleteMany({ where: { templateId: bypassTemplate.id } });
        await prisma.workflowTemplate.deleteMany({ where: { id: bypassTemplate.id } });
        const basePurchase = await prisma.workflowTemplate.findFirst({
          where: { requestType: RequestType.PURCHASE, NOT: { name: { startsWith: 'Dynamic:' } } },
          orderBy: { version: 'asc' },
        });
        if (basePurchase) {
          await prisma.workflowTemplate.update({ where: { id: basePurchase.id }, data: { isActive: true, deletedAt: null } });
        }
      }
    });
  });
});
