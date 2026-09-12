import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { UserService } from '../../src/services/user.service';
import { DepartmentService } from '../../src/services/department.service';
import { WorkflowService } from '../../src/services/workflow.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver, resolveActiveWorkflowTemplate } from '../../src/core/StepResolver';
import { RequestService } from '../../src/request/request.service';
import { getRequestMonetaryAmount, RuleContext } from '../../src/core/workflow.rules';
import { UserRole, RequestType, Priority, RequestStatus } from '@prisma/client';

describe('MediFlow Phase 3 — End-to-End Lifecycle, Security & Invariants', { timeout: 45000 }, () => {
  let activeAdmin: any;
  let hodCardio: any;
  let employeeCardio: any;
  let employee2Cardio: any;
  let financeUser1: any;
  let financeUser2: any;
  let purchaseUser: any;
  let maintenanceUser: any;
  let directorUser: any;
  let hrUser: any;

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
    activeAdmin = await prisma.user.findFirstOrThrow({ where: { role: UserRole.ADMIN, isActive: true } });
    hodCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HOD, email: 'hod.cardio@mediflow.com' } });
    employeeCardio = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' } });
    financeUser1 = await prisma.user.findFirstOrThrow({ where: { role: UserRole.FINANCE_OFFICER, email: 'finance@mediflow.com' } });
    purchaseUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.PURCHASE_OFFICER } });
    maintenanceUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MAINTENANCE_OFFICER } });
    directorUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.DIRECTOR } });
    hrUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HR } });

    // Create or find a secondary employee and secondary finance officer for forwarding tests
    let emp2 = await prisma.user.findUnique({ where: { email: 'employee2.p3@mediflow.com' } });
    if (!emp2) {
      emp2 = await UserService.createUser({
        email: 'employee2.p3@mediflow.com',
        employeeId: 'EMP-P3-002',
        firstName: 'Jane',
        lastName: 'CardioStaff',
        role: UserRole.EMPLOYEE,
        departmentId: employeeCardio.departmentId,
      });
    }
    employee2Cardio = emp2;

    let fin2 = await prisma.user.findUnique({ where: { email: 'finance2.p3@mediflow.com' } });
    if (!fin2) {
      fin2 = await UserService.createUser({
        email: 'finance2.p3@mediflow.com',
        employeeId: 'EMP-P3-FIN2',
        firstName: 'Arthur',
        lastName: 'BudgetOfficer',
        role: UserRole.FINANCE_OFFICER,
        departmentId: financeUser1.departmentId,
      });
    }
    financeUser2 = fin2;

    // Ensure base templates for all 3 request types are active and not deleted
    for (const type of [RequestType.PURCHASE, RequestType.MAINTENANCE, RequestType.LEAVE]) {
      const base = await prisma.workflowTemplate.findFirst({
        where: { requestType: type, NOT: { name: { startsWith: 'Dynamic:' } } },
        orderBy: { version: 'asc' },
      });
      if (base) {
        await prisma.workflowTemplate.updateMany({
          where: { requestType: type, NOT: { id: base.id } },
          data: { isActive: false },
        });
        await prisma.workflowTemplate.update({
          where: { id: base.id },
          data: { isActive: true, deletedAt: null },
        });
      }
    }
  });

  // 1. ADMIN cannot approve merely because they are ADMIN
  it('1. ADMIN cannot approve merely because they are ADMIN', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST1-${Date.now()}`,
        title: 'Diagnostic Stethoscope',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Cardiology Grade Stethoscope',
            quantity: 1,
            estimatedCost: 12000,
            justification: 'Clinic rounds replacement',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // canUserActOnRequest returns false for Admin
      const canAct = await WorkflowEngine.canUserActOnRequest(req.id, activeAdmin.id);
      expect(canAct).toBe(false);

      // Normal approve call by Admin without explicit override is rejected with 403
      await expect(
        WorkflowEngine.approve(req.id, 'Admin normal approve attempt', toAuthUser(activeAdmin, 'ADMIN'))
      ).rejects.toThrow(/You cannot take action on this step/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 2. Unauthorized user cannot approve (wrong role / wrong department)
  it('2. Unauthorized user cannot approve (wrong role / wrong department)', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST2-${Date.now()}`,
        title: 'Surgical Tray Sets',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Standard surgical trays',
            quantity: 2,
            estimatedCost: 8000,
            justification: 'OPD inventory',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Maintenance Officer tries to approve HOD Step 1 -> 403
      await expect(
        WorkflowEngine.approve(req.id, 'Unauthorized role acting', toAuthUser(maintenanceUser, 'FAC'))
      ).rejects.toThrow(/You cannot take action on this step/);

      // Director tries to approve HOD Step 1 -> 403
      await expect(
        WorkflowEngine.approve(req.id, 'Director jumping ahead', toAuthUser(directorUser, 'EXEC'))
      ).rejects.toThrow(/You cannot take action on this step/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 3. Unauthorized user cannot forward
  it('3. Unauthorized user cannot forward', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST3-${Date.now()}`,
        title: 'Infusion Pumps',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Syringe pump units',
            quantity: 2,
            estimatedCost: 40000,
            justification: 'ICU replacement',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Normal employee or HR cannot forward HOD's step
      await expect(
        WorkflowEngine.forward(req.id, hodCardio.id, 'Unauthorized forward', toAuthUser(hrUser, 'HR'))
      ).rejects.toThrow(/You cannot take action on this step/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 4. Old assignee cannot approve after reassignment
  it('4. Old assignee cannot approve after reassignment', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST4-${Date.now()}`,
        title: 'Ventilator Filter Replacements',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'High efficiency particulate air filters',
            quantity: 20,
            estimatedCost: 150000, // > 100k -> Finance first
            justification: 'Ventilator maintenance cycle',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Initially Finance User 1 can act
      expect(await WorkflowEngine.canUserActOnRequest(req.id, financeUser1.id)).toBe(true);

      // Forward from Finance User 1 to Finance User 2
      await WorkflowEngine.forward(req.id, financeUser2.id, 'Delegating to Finance Officer 2', toAuthUser(financeUser1, 'FIN'));

      // Old assignee (Finance User 1) CANNOT approve after reassignment
      expect(await WorkflowEngine.canUserActOnRequest(req.id, financeUser1.id)).toBe(false);
      await expect(
        WorkflowEngine.approve(req.id, 'Old assignee approval attempt', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow(/This request has been specifically assigned to another reviewer/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 5. New assignee can act
  it('5. New assignee can act', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST5-${Date.now()}`,
        title: 'Ventilator Hose Sets',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Silicone ventilator breathing hoses',
            quantity: 10,
            estimatedCost: 120000, // > 100k -> Finance first
            justification: 'Ventilator circuit consumable replenishment',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Forward from Finance User 1 to Finance User 2
      await WorkflowEngine.forward(req.id, financeUser2.id, 'Reassigning to FO2', toAuthUser(financeUser1, 'FIN'));

      // New assignee (Finance User 2) CAN act and approve
      expect(await WorkflowEngine.canUserActOnRequest(req.id, financeUser2.id)).toBe(true);
      const approvedStep1 = await WorkflowEngine.approve(req.id, 'Approved by FO2', toAuthUser(financeUser2, 'FIN'));
      expect(approvedStep1.status).toBe(RequestStatus.IN_REVIEW);

      // Step 2 is now HOD (and assignedToUserId is reset for next step pool)
      const afterStep1 = await prisma.request.findUniqueOrThrow({ where: { id: req.id }, include: { currentStep: true } });
      expect(afterStep1.currentStep?.approverRole).toBe(UserRole.HOD);
      expect(afterStep1.assignedToUserId).toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 6. Requester cannot approve (no self-approval)
  it('6. Requester cannot approve (no self-approval)', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    // HOD creates a purchase request
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST6-${Date.now()}`,
        title: 'Cardiac Monitoring Pads',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: hodCardio.id,
        departmentId: hodCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Disposable ECG monitoring pads',
            quantity: 10,
            estimatedCost: 15000,
            justification: 'Department clinical supply replenishment',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(hodCardio, 'CARD'));

      // HOD cannot act on their own request
      const canAct = await WorkflowEngine.canUserActOnRequest(req.id, hodCardio.id);
      expect(canAct).toBe(false);

      await expect(
        WorkflowEngine.approve(req.id, 'Self approval attempt', toAuthUser(hodCardio, 'CARD'))
      ).rejects.toThrow(/You cannot approve your own request/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 7. Requester cannot be selected as forwarding recipient
  it('7. Requester cannot be selected as forwarding recipient', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST7-${Date.now()}`,
        title: 'Pulse Oximeter Probes',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: hodCardio.id, // Requester is HOD
        departmentId: hodCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Reusable pulse oximeter finger sensors',
            quantity: 5,
            estimatedCost: 25000,
            justification: 'Ward supply',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(hodCardio, 'CARD'));

      // Attempt to forward to the requester (HOD) -> 400
      await expect(
        WorkflowEngine.forward(req.id, hodCardio.id, 'Forward back to requester', toAuthUser(purchaseUser, 'PROC'))
      ).rejects.toThrow(/Cannot forward request to the original requester/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 8. Inactive users cannot receive forwarding
  it('8. Inactive users cannot receive forwarding', async () => {
    // Create an inactive user matching Finance Officer role
    const inactiveUser = await UserService.createUser({
      email: `inactive.fo.${Date.now()}@mediflow.com`,
      employeeId: `EMP-INACT-${Date.now().toString().slice(-4)}`,
      firstName: 'Inactive',
      lastName: 'Officer',
      role: UserRole.FINANCE_OFFICER,
      departmentId: financeUser1.departmentId,
    });
    await UserService.updateUser(inactiveUser.id, { isActive: false });

    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST8-${Date.now()}`,
        title: 'Surgical Lighting Rig',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Ceiling mounted OT lighting set',
            quantity: 1,
            estimatedCost: 200000, // > 100k -> Finance first
            justification: 'Operation theater overhaul',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Forwarding to inactive user is rejected with 404
      await expect(
        WorkflowEngine.forward(req.id, inactiveUser.id, 'Forward to deactivated user', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow(/Target recipient not found or is inactive/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: inactiveUser.id } });
      await prisma.user.delete({ where: { id: inactiveUser.id } });
    }
  });

  // 9. Completed requests (APPROVED / REJECTED) cannot be approved or forwarded again
  it('9. Completed requests cannot be approved or forwarded again', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST9-${Date.now()}`,
        title: 'Paper Rolls for ECG',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Thermal ECG printing paper',
            quantity: 10,
            estimatedCost: 3000,
            justification: 'Daily diagnostics supply',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      // Step 1: HOD approves
      await WorkflowEngine.approve(req.id, 'HOD OK', toAuthUser(hodCardio, 'CARD'));
      // Step 2: Purchase Officer approves (Final) -> APPROVED
      const completed = await WorkflowEngine.approve(req.id, 'Procured', toAuthUser(purchaseUser, 'PROC'));
      expect(completed.status).toBe(RequestStatus.APPROVED);

      // Attempting to approve again -> 400
      await expect(
        WorkflowEngine.approve(req.id, 'Second approval attempt', toAuthUser(purchaseUser, 'PROC'))
      ).rejects.toThrow(/This request is not under review right now/);

      // Attempting to forward an approved request -> 400
      await expect(
        WorkflowEngine.forward(req.id, financeUser1.id, 'Attempt forward after completion', toAuthUser(purchaseUser, 'PROC'))
      ).rejects.toThrow(/This request is not under review right now/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 10. Finance request cannot be forwarded outside Finance before Finance approval
  it('10. Finance request cannot be forwarded outside Finance before Finance approval', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-TEST10-${Date.now()}`,
        title: 'CT Scanner Tube Replacement',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'High capacity X-ray tube for CT scanner',
            quantity: 1,
            estimatedCost: 850000, // > 100k -> Finance first
            justification: 'Radiology tube degradation',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Attempting to forward Finance step to a non-Finance user (e.g. HOD or Purchase) -> 400
      await expect(
        WorkflowEngine.forward(req.id, hodCardio.id, 'Forwarding outside Finance', toAuthUser(financeUser1, 'FIN'))
      ).rejects.toThrow(/Target recipient must have role FINANCE_OFFICER/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 11. Finance display-name changes do not break Finance-first routing or authorization
  it('11. Finance display-name changes do not break Finance-first routing or authorization', async () => {
    const finDept = await prisma.department.findUniqueOrThrow({ where: { code: 'FIN' } });
    const originalDisplayName = finDept.displayName;

    try {
      // Modify display name to a non-standard name
      await DepartmentService.updateDepartment(finDept.id, {
        displayName: 'Department of Budgetary Oversight and Fiscal Audits',
      });

      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P3-TEST11-${Date.now()}`,
          title: 'Advanced Heart-Lung Machine Bypass Circuit',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: employeeCardio.departmentId,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Extracorporeal perfusion circuit',
              quantity: 2,
              estimatedCost: 450000, // > 100k
              justification: 'Cardiac surgery consumables',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));
      const steps = await StepResolver.getStepsForRequest(req.id);

      // Step 1 MUST still be Finance
      expect(steps[0]!.approverRole).toBe(UserRole.FINANCE_OFFICER);

      // Finance user authorization check uses stable department code 'FIN'
      const canAct = await WorkflowEngine.canUserActOnRequest(req.id, financeUser1.id);
      expect(canAct).toBe(true);

      // Non-finance user receives 403
      const nonFinUser = await UserService.createUser({
        email: `fake.finance.${Date.now()}@mediflow.com`,
        employeeId: `FF-${Date.now().toString().slice(-4)}`,
        firstName: 'Fake',
        lastName: 'Finance',
        role: UserRole.FINANCE_OFFICER,
        departmentId: employeeCardio.departmentId, // In Cardiology, NOT Finance!
      });

      const fakeCanAct = await WorkflowEngine.canUserActOnRequest(req.id, nonFinUser.id);
      expect(fakeCanAct).toBe(false);

      await expect(
        WorkflowEngine.approve(req.id, 'Fake finance approval', toAuthUser(nonFinUser, 'CARD'))
      ).rejects.toThrow(/Only Finance department personnel can approve/);

      // Cleanup
      await prisma.auditLog.deleteMany({ where: { actorId: nonFinUser.id } });
      await prisma.user.delete({ where: { id: nonFinUser.id } });

      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    } finally {
      await DepartmentService.updateDepartment(finDept.id, { displayName: originalDisplayName });
    }
  });

  // 12. Workflow deactivation cannot leave new requests without a valid workflow
  it('12. Workflow deactivation cannot leave new requests without a valid workflow', async () => {
    // Attempting to archive the only active template for LEAVE must throw
    const activeLeaveTemplates = await prisma.workflowTemplate.findMany({
      where: {
        requestType: RequestType.LEAVE,
        isActive: true,
        deletedAt: null,
        NOT: { name: { startsWith: 'Dynamic:' } },
      },
    });

    if (activeLeaveTemplates.length === 1) {
      await expect(WorkflowService.archiveTemplate(activeLeaveTemplates[0].id)).rejects.toThrow(
        /Cannot archive or deactivate the only active workflow template/
      );
    }

    // Resolving active template always guarantees an active template is returned
    const resolved = await resolveActiveWorkflowTemplate(RequestType.LEAVE);
    expect(resolved.isActive).toBe(true);
    expect(resolved.deletedAt).toBeNull();
    expect(resolved.name.startsWith('Dynamic:')).toBe(false);
  });

  // 13. Existing requests remain attached to their original workflow version across version updates
  it('13. Existing requests remain attached to their original workflow version across version updates', async () => {
    const activeTemplate = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);
    const initialVersion = activeTemplate.version;

    // 1. Create Request A using Version 1
    const reqA = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-V1-${Date.now()}`,
        title: 'Operating Room Autoclave Calibration',
        type: RequestType.MAINTENANCE,
        priority: Priority.HIGH,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: activeTemplate.id,
        maintenanceDetail: {
          create: {
            equipmentName: 'Autoclave Sterilizer 400',
            location: 'Main CSSD',
            urgencyLevel: 'HIGH',
            issueDescription: 'Pressure seal inspection required',
          },
        },
      },
    });

    await WorkflowEngine.submitRequest(reqA.id, toAuthUser(employeeCardio, 'CARD'));
    const stepsABefore = await StepResolver.getStepsForRequest(reqA.id);

    // 2. Admin creates and activates Version 2 with a new custom step configuration
    const v2 = await WorkflowService.createNewVersion(activeTemplate.id, {
      name: `Maintenance Workflow Version ${initialVersion + 1}`,
      steps: [
        { stepName: 'HOD Fast Triage', order: 1, approverRole: UserRole.HOD },
        { stepName: 'Director Maintenance Review', order: 2, approverRole: UserRole.DIRECTOR },
        { stepName: 'Facilities Finalization', order: 3, approverRole: UserRole.MAINTENANCE_OFFICER, isFinal: true },
      ],
    });
    expect(v2.isActive).toBe(true);
    expect(v2.version).toBeGreaterThan(initialVersion);

    let reqB: any = null;
    try {
      // 3. Continue Request A: ensure Request A still follows its original Version 1 steps!
      const stepsAAfter = await StepResolver.getStepsForRequest(reqA.id);
      expect(stepsAAfter.length).toBe(stepsABefore.length);
      expect(stepsAAfter[0]!.stepName).toBe(stepsABefore[0]!.stepName);

      // Verify Request A advances through its original V1 step, NOT V2's Director step
      await WorkflowEngine.approve(reqA.id, 'HOD Approved V1', toAuthUser(hodCardio, 'CARD'));
      const reqAInFlight = await prisma.request.findUniqueOrThrow({
        where: { id: reqA.id },
        include: { currentStep: true },
      });
      // V1 Step 2 is MAINTENANCE_OFFICER, whereas V2 Step 2 is DIRECTOR
      expect(reqAInFlight.currentStep?.approverRole).toBe(UserRole.MAINTENANCE_OFFICER);

      // 4. Create Request B: confirms Request B uses newly activated Version 2
      reqB = await RequestService.createRequest({
        title: 'Emergency Power Backup Filter',
        type: RequestType.MAINTENANCE,
        priority: Priority.HIGH,
        details: {
          equipmentName: 'Generator B',
          location: 'Basement Substation',
          urgencyLevel: 'HIGH',
          issueDescription: 'Coolant line check',
        },
      }, toAuthUser(employeeCardio, 'CARD'));

      await WorkflowEngine.submitRequest(reqB.id, toAuthUser(employeeCardio, 'CARD'));
      const stepsB = await StepResolver.getStepsForRequest(reqB.id);

      // Request B must follow Version 2 (3 steps, Step 2 is DIRECTOR)
      expect(stepsB.length).toBe(3);
      expect(stepsB[1]!.approverRole).toBe(UserRole.DIRECTOR);

    } finally {
      // Cleanup test requests
      if (reqA) {
        await prisma.auditLog.deleteMany({ where: { requestId: reqA.id } });
        await prisma.approvalAction.deleteMany({ where: { requestId: reqA.id } });
        await prisma.notification.deleteMany({ where: { requestId: reqA.id } });
        await prisma.maintenanceDetail.deleteMany({ where: { requestId: reqA.id } });
        await prisma.request.deleteMany({ where: { id: reqA.id } });
      }
      if (reqB) {
        await prisma.auditLog.deleteMany({ where: { requestId: reqB.id } });
        await prisma.approvalAction.deleteMany({ where: { requestId: reqB.id } });
        await prisma.notification.deleteMany({ where: { requestId: reqB.id } });
        await prisma.maintenanceDetail.deleteMany({ where: { requestId: reqB.id } });
        await prisma.request.deleteMany({ where: { id: reqB.id } });
      }

      // Restore V1 as active template and delete temporary V2
      if (activeTemplate) {
        await WorkflowService.activateTemplate(activeTemplate.id);
      }
      if (v2) {
        await prisma.workflowStep.deleteMany({ where: { templateId: v2.id } });
        await prisma.workflowTemplate.delete({ where: { id: v2.id } });
      }
    }
  });

  // 14. Client-side manipulation of `canAct` / direct API call does not bypass backend authorization
  it('14. Client-side manipulation of canAct / direct API call does not bypass backend authorization', async () => {
    const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
    const req = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-CANACT-${Date.now()}`,
        title: 'ECG Electrodes',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Silver/silver chloride ECG electrodes',
            quantity: 50,
            estimatedCost: 5000,
            justification: 'Diagnostic ward supply',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio, 'CARD'));

      // Requester viewing the request sees canAct=false (cannot self-approve)
      const requesterView = await RequestService.getRequestById(req.id, toAuthUser(employeeCardio, 'CARD'));
      expect((requesterView as any).canAct).toBe(false);

      // Step 1 approver (HOD) viewing the request sees canAct=true
      const hodView = await RequestService.getRequestById(req.id, toAuthUser(hodCardio, 'CARD'));
      expect((hodView as any).canAct).toBe(true);

      // If unauthorized user bypasses the UI and attempts direct approval -> 403
      await expect(
        WorkflowEngine.approve(req.id, 'Hacked button bypass', toAuthUser(employee2Cardio, 'CARD'))
      ).rejects.toThrow(/You cannot take action on this step/);

      // If requester tries to approve their own request -> 403
      await expect(
        WorkflowEngine.approve(req.id, 'Requester self approval attempt', toAuthUser(employeeCardio, 'CARD'))
      ).rejects.toThrow(/You cannot approve your own request/);

      // If unauthorized user attempts direct forward -> 403
      await expect(
        WorkflowEngine.forward(req.id, hodCardio.id, 'Hacked forward bypass', toAuthUser(employee2Cardio, 'CARD'))
      ).rejects.toThrow(/You cannot take action on this step/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 15. Monetary extraction verified carefully by request type
  it('15. Monetary extraction verified carefully by request type', async () => {
    // A. Purchase request: has estimatedCost
    const purchaseCtx: RuleContext = {
      type: RequestType.PURCHASE,
      priority: Priority.HIGH,
      departmentCode: 'CARD',
      requesterRole: UserRole.EMPLOYEE,
      details: { estimatedCost: 150000 },
    };
    expect(getRequestMonetaryAmount(purchaseCtx)).toBe(150000);

    // B. Maintenance request: has NO monetary cost in schema
    const maintenanceCtx: RuleContext = {
      type: RequestType.MAINTENANCE,
      priority: Priority.EMERGENCY,
      departmentCode: 'CARD',
      requesterRole: UserRole.EMPLOYEE,
      details: { urgencyLevel: 'EMERGENCY' },
    };
    // Must return null, not throw or invent cost
    expect(getRequestMonetaryAmount(maintenanceCtx)).toBeNull();

    // Verify Maintenance requests never accidentally trigger Finance-first
    const maintTemplate = await resolveActiveWorkflowTemplate(RequestType.MAINTENANCE);
    const maintReq = await prisma.request.create({
      data: {
        referenceNumber: `REQ-P3-MAINT-${Date.now()}`,
        title: 'MRI Cooling Plant Emergency Valve',
        type: RequestType.MAINTENANCE,
        priority: Priority.EMERGENCY,
        status: RequestStatus.DRAFT,
        requestedById: employeeCardio.id,
        departmentId: employeeCardio.departmentId,
        workflowTemplateId: maintTemplate.id,
        maintenanceDetail: {
          create: {
            equipmentName: 'Helium Compressor Unit 1',
            location: 'MRI Suite Plant Room',
            urgencyLevel: 'EMERGENCY',
            issueDescription: 'Coolant pressure drop alarm triggered',
          },
        },
      },
    });

    try {
      await WorkflowEngine.submitRequest(maintReq.id, toAuthUser(employeeCardio, 'CARD'));
      const maintSteps = await StepResolver.getStepsForRequest(maintReq.id);

      // Maintenance should NOT have Finance Officer
      const hasFinance = maintSteps.some(s => s.approverRole === UserRole.FINANCE_OFFICER);
      expect(hasFinance).toBe(false);

      // C. Leave request: has NO monetary cost in schema
      const leaveCtx: RuleContext = {
        type: RequestType.LEAVE,
        priority: Priority.NORMAL,
        departmentCode: 'CARD',
        requesterRole: UserRole.EMPLOYEE,
        details: { totalDays: 5, leaveType: 'CASUAL' },
      };
      expect(getRequestMonetaryAmount(leaveCtx)).toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: maintReq.id } });
      await prisma.notification.deleteMany({ where: { requestId: maintReq.id } });
      await prisma.maintenanceDetail.deleteMany({ where: { requestId: maintReq.id } });
      await prisma.request.delete({ where: { id: maintReq.id } });
    }
  });
});
