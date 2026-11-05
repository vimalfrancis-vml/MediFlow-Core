import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { RequestType, Priority, UserRole, RequestStatus } from '@prisma/client';

describe('Workflow Preview for Draft and Returned Requests', () => {
  let employeeUser: any;
  let hodUser: any;
  let financeUser: any;

  let employeeActor: AuthUser;
  let hodActor: AuthUser;
  let financeActor: AuthUser;

  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, isActive: true, deletedAt: null },
      include: { department: true },
    });

    hodUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HOD, departmentId: employeeUser.departmentId, isActive: true, deletedAt: null },
      include: { department: true },
    });

    financeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.FINANCE_OFFICER, isActive: true, deletedAt: null },
      include: { department: true },
    });

    employeeActor = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: employeeUser.department.code,
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    hodActor = {
      id: hodUser.id,
      email: hodUser.email,
      role: hodUser.role,
      departmentId: hodUser.departmentId,
      departmentCode: hodUser.department.code,
      firstName: hodUser.firstName,
      lastName: hodUser.lastName,
    };

    financeActor = {
      id: financeUser.id,
      email: financeUser.email,
      role: financeUser.role,
      departmentId: financeUser.departmentId,
      departmentCode: financeUser.department.code,
      firstName: financeUser.firstName,
      lastName: financeUser.lastName,
    };
  });

  afterAll(async () => {
    if (createdRequestIds.length > 0) {
      await prisma.purchaseDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.leaveDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.maintenanceDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.approvalAction.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.notification.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.auditLog.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
  });

  it('updates purchase workflow preview when cost changes across the ₹1,00,000 threshold and back without database template creation', async () => {
    // 1. Create a draft purchase request with cost ₹50,000 (below threshold)
    const req = await RequestService.createRequest(
      {
        title: 'Preview Threshold Purchase Test',
        type: RequestType.PURCHASE,
        priority: Priority.MEDIUM,
        details: {
          itemDescription: 'Laboratory Glassware',
          estimatedCost: 50000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    const initialTemplateId = req.workflowTemplateId;

    // Fetch via getRequestById: Preview should show base workflow (HOD -> Purchase Officer)
    const preview1 = await RequestService.getRequestById(req.id, employeeActor);
    const steps1 = preview1.workflowTemplate.steps;
    expect(steps1).toHaveLength(2);
    expect(steps1[0].approverRole).toBe(UserRole.HOD);
    expect(steps1[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(steps1.some((s: any) => s.approverRole === UserRole.DIRECTOR)).toBe(false);

    // Verify database state: NO dynamic template was created in the database
    const dbReq1 = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
    expect(dbReq1.workflowTemplateId).toBe(initialTemplateId);
    const dynamicTmpl1 = await prisma.workflowTemplate.findFirst({
      where: { name: { contains: req.referenceNumber } },
    });
    expect(dynamicTmpl1).toBeNull();

    // 2. Edit draft purchase amount to ₹180,000 (above threshold)
    await RequestService.editRequest(
      req.id,
      {
        details: {
          itemDescription: 'Laboratory Centrifuge High-Capacity',
          estimatedCost: 180000,
        },
      },
      employeeActor
    );

    // Fetch via getRequestById: Preview should dynamically show 4 steps
    // (Finance Review -> HOD -> Purchase Officer -> Director)
    const preview2 = await RequestService.getRequestById(req.id, employeeActor);
    const steps2 = preview2.workflowTemplate.steps;
    expect(steps2).toHaveLength(4);
    expect(steps2[0].approverRole).toBe(UserRole.FINANCE_OFFICER);
    expect(steps2[1].approverRole).toBe(UserRole.HOD);
    expect(steps2[2].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(steps2[3].approverRole).toBe(UserRole.DIRECTOR);
    expect(steps2[3].isFinal).toBe(true);

    // Verify database state: Still NO dynamic template persisted merely for preview!
    const dbReq2 = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
    expect(dbReq2.workflowTemplateId).toBe(initialTemplateId);
    const dynamicTmpl2 = await prisma.workflowTemplate.findFirst({
      where: { name: { contains: req.referenceNumber } },
    });
    expect(dynamicTmpl2).toBeNull();

    // 3. Edit draft purchase amount back down to ₹35,000 (below threshold)
    await RequestService.editRequest(
      req.id,
      {
        details: {
          itemDescription: 'Basic Lab Pipettes',
          estimatedCost: 35000,
        },
      },
      employeeActor
    );

    // Fetch via getRequestById: Preview should revert to 2 steps (HOD -> Purchase Officer)
    const preview3 = await RequestService.getRequestById(req.id, employeeActor);
    const steps3 = preview3.workflowTemplate.steps;
    expect(steps3).toHaveLength(2);
    expect(steps3[0].approverRole).toBe(UserRole.HOD);
    expect(steps3[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(steps3.some((s: any) => s.approverRole === UserRole.DIRECTOR)).toBe(false);

    // Database still remains pointing to the clean base template
    const dbReq3 = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
    expect(dbReq3.workflowTemplateId).toBe(initialTemplateId);
  });

  it('updates leave workflow preview when duration or priority triggers Medical Superintendent approval', async () => {
    // 1. Create standard leave request: 5 days, LOW priority (only HOD approval required)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 4); // 5 days

    const req = await RequestService.createRequest(
      {
        title: 'Draft Leave Preview Test',
        type: RequestType.LEAVE,
        priority: Priority.LOW,
        details: {
          leaveType: 'VACATION',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          reason: 'Annual family holiday',
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    // Base leave flow: 2 steps (HOD -> HR)
    const preview1 = await RequestService.getRequestById(req.id, employeeActor);
    const steps1 = preview1.workflowTemplate.steps;
    expect(steps1).toHaveLength(2);
    expect(steps1[0].approverRole).toBe(UserRole.HOD);
    expect(steps1[1].approverRole).toBe(UserRole.HR);

    // 2. Edit leave request to 20 days (> 14 days threshold)
    const longEndDate = new Date(startDate);
    longEndDate.setDate(longEndDate.getDate() + 19); // 20 days

    await RequestService.editRequest(
      req.id,
      {
        details: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: longEndDate.toISOString().split('T')[0],
          reason: 'Extended medical recovery',
        },
      },
      employeeActor
    );

    // Preview should dynamically show 3 steps: HOD -> Medical Superintendent -> HR
    const preview2 = await RequestService.getRequestById(req.id, employeeActor);
    const steps2 = preview2.workflowTemplate.steps;
    expect(steps2).toHaveLength(3);
    expect(steps2[0].approverRole).toBe(UserRole.HOD);
    expect(steps2[1].approverRole).toBe(UserRole.MEDICAL_SUPERINTENDENT);
    expect(steps2[2].approverRole).toBe(UserRole.HR);

    // 3. Edit leave back to short duration but set priority to EMERGENCY
    await RequestService.editRequest(
      req.id,
      {
        priority: Priority.EMERGENCY,
        details: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0], // 5 days
          reason: 'Urgent family emergency leave',
        },
      },
      employeeActor
    );

    // Emergency priority also previews Medical Superintendent approval (3 steps)
    const preview3 = await RequestService.getRequestById(req.id, employeeActor);
    const steps3 = preview3.workflowTemplate.steps;
    expect(steps3).toHaveLength(3);
    expect(steps3[0].approverRole).toBe(UserRole.HOD);
    expect(steps3[1].approverRole).toBe(UserRole.MEDICAL_SUPERINTENDENT);
    expect(steps3[2].approverRole).toBe(UserRole.HR);

    // 4. Edit back to LOW priority and 5 days: reverts to 2 steps (HOD -> HR)
    await RequestService.editRequest(
      req.id,
      {
        priority: Priority.LOW,
      },
      employeeActor
    );
    const preview4 = await RequestService.getRequestById(req.id, employeeActor);
    const steps4 = preview4.workflowTemplate.steps;
    expect(steps4).toHaveLength(2);
    expect(steps4[0].approverRole).toBe(UserRole.HOD);
    expect(steps4[1].approverRole).toBe(UserRole.HR);
  });

  it('adjusts maintenance preview to prevent HOD self-approval when requested by HOD', async () => {
    // 1. Employee-requested maintenance
    const empReq = await RequestService.createRequest(
      {
        title: 'Employee Maintenance Request',
        type: RequestType.MAINTENANCE,
        priority: Priority.MEDIUM,
        details: {
          equipmentName: 'Wheelchair #12',
          location: 'Ward A',
          urgencyLevel: 'NORMAL',
          issueDescription: 'Broken armrest',
        },
      },
      employeeActor
    );
    createdRequestIds.push(empReq.id);

    const empPreview = await RequestService.getRequestById(empReq.id, employeeActor);
    // Employee maintenance: HOD is the first approver
    expect(empPreview.workflowTemplate.steps[0].approverRole).toBe(UserRole.HOD);

    // 2. HOD-requested maintenance: HOD step must be replaced with Director (no self-approval)
    const hodReq = await RequestService.createRequest(
      {
        title: 'HOD Maintenance Request',
        type: RequestType.MAINTENANCE,
        priority: Priority.MEDIUM,
        details: {
          equipmentName: 'Air Conditioner Unit',
          location: 'HOD Office',
          urgencyLevel: 'NORMAL',
          issueDescription: 'AC cooling unit failure',
        },
      },
      hodActor
    );
    createdRequestIds.push(hodReq.id);

    const hodPreview = await RequestService.getRequestById(hodReq.id, hodActor);
    // For HOD requester, HOD step is replaced with DIRECTOR
    expect(hodPreview.workflowTemplate.steps.some((s: any) => s.approverRole === UserRole.HOD)).toBe(false);
    expect(hodPreview.workflowTemplate.steps.some((s: any) => s.approverRole === UserRole.DIRECTOR)).toBe(true);
  });

  it('updates preview for RETURNED requests when requester modifies details', async () => {
    // 1. Create and submit high-cost purchase (> ₹1,00,000)
    const req = await RequestService.createRequest(
      {
        title: 'Returned Request Preview Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Digital Microscope System',
          estimatedCost: 140000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    // Submit into review (Finance Officer is first step)
    await WorkflowEngine.submitRequest(req.id, employeeActor);

    // Finance Officer returns for correction
    await WorkflowEngine.returnForCorrection(req.id, 'Please negotiate vendor discount below ₹1,00,000', financeActor);

    const returnedReq = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
    expect(returnedReq.status).toBe(RequestStatus.RETURNED);

    // 2. Requester edits amount down to ₹85,000
    await RequestService.editRequest(
      req.id,
      {
        details: {
          itemDescription: 'Digital Microscope System (Discounted)',
          estimatedCost: 85000,
        },
      },
      employeeActor
    );

    // Preview for the RETURNED request should now reflect the 2-step workflow (HOD -> Purchase Officer)
    const preview = await RequestService.getRequestById(req.id, employeeActor);
    const steps = preview.workflowTemplate.steps;
    expect(steps).toHaveLength(2);
    expect(steps[0].approverRole).toBe(UserRole.HOD);
    expect(steps[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(steps.some((s: any) => s.approverRole === UserRole.DIRECTOR)).toBe(false);
    expect(steps.some((s: any) => s.approverRole === UserRole.FINANCE_OFFICER)).toBe(false);
  });

  it('does not alter the persisted steps for requests already IN_REVIEW or completed', async () => {
    // Create and submit high-cost request
    const req = await RequestService.createRequest(
      {
        title: 'In-Flight Immutability Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Anesthesia Workstation',
          estimatedCost: 220000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    // Submit request (IN_REVIEW)
    const submitted = await WorkflowEngine.submitRequest(req.id, employeeActor);
    expect(submitted.status).toBe(RequestStatus.IN_REVIEW);

    // Fetch via getRequestById
    const inFlightDetails = await RequestService.getRequestById(req.id, employeeActor);
    const persistedStepsInDb = await prisma.workflowStep.findMany({
      where: { templateId: submitted.workflowTemplateId },
      orderBy: { order: 'asc' },
    });

    // Returned steps must match persisted steps in DB exactly
    expect(inFlightDetails.workflowTemplate.steps.map((s: any) => s.id)).toEqual(
      persistedStepsInDb.map((s) => s.id)
    );
  });
});
