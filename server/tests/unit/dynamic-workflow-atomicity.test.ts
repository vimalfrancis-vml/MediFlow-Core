import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { StepResolver } from '../../src/core/StepResolver';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { RequestType, Priority, UserRole, RequestStatus, ApprovalActionType } from '@prisma/client';

describe('Dynamic Workflow Template & Approval Step Atomicity', () => {
  let employeeUser: any;
  let hodUser: any;
  let financeUser: any;
  let employeeActor: AuthUser;
  let hodActor: AuthUser;
  let financeActor: AuthUser;

  const createdRequestIds: string[] = [];
  const createdTemplateIds: string[] = [];

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
    vi.restoreAllMocks();
    if (createdRequestIds.length > 0) {
      await prisma.purchaseDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.approvalAction.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.notification.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.auditLog.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
    if (createdTemplateIds.length > 0) {
      await prisma.workflowStep.deleteMany({ where: { templateId: { in: createdTemplateIds } } });
      await prisma.workflowTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    }
  });

  it('atomically creates a dynamic workflow template and adjusted approval steps on success', async () => {
    // High-cost purchase request (> ₹1,00,000) triggers dynamic Director step injection and Finance-first review
    const req = await RequestService.createRequest(
      {
        title: 'High-Cost Dynamic Flow Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'MRI Machine Replacement Part',
          estimatedCost: 150000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    const baseTemplateId = req.workflowTemplateId;

    // Resolve steps
    const steps = await StepResolver.getStepsForRequest(req.id);
    expect(steps.length).toBeGreaterThanOrEqual(3);

    // Final step should be DIRECTOR
    const lastStep = steps[steps.length - 1];
    expect(lastStep.approverRole).toBe(UserRole.DIRECTOR);
    expect(lastStep.isFinal).toBe(true);

    // Verify request now links to dynamic template
    const updatedReq = await prisma.request.findUniqueOrThrow({
      where: { id: req.id },
      include: { workflowTemplate: { include: { steps: true } } },
    });
    expect(updatedReq.workflowTemplateId).not.toBe(baseTemplateId);
    expect(updatedReq.workflowTemplate.name).toContain(`Dynamic:`);
    expect(updatedReq.workflowTemplate.name).toContain(req.referenceNumber);
    expect(updatedReq.workflowTemplate.isActive).toBe(false);

    createdTemplateIds.push(updatedReq.workflowTemplateId);
  });

  it('rolls back completely if a failure occurs during step creation', async () => {
    const req = await RequestService.createRequest(
      {
        title: 'Rollback On Step Failure Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Computed Tomography Scanner',
          estimatedCost: 250000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    const originalBaseTemplateId = req.workflowTemplateId;

    // Intercept $transaction to simulate step creation failure on step 2
    const originalTx = prisma.$transaction.bind(prisma);
    const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, ...rest: any[]) => {
      return originalTx(async (tx: any) => {
        let stepCount = 0;
        const originalStepCreate = tx.workflowStep.create.bind(tx.workflowStep);
        tx.workflowStep.create = vi.fn().mockImplementation(async (args: any) => {
          stepCount++;
          if (stepCount >= 2) {
            throw new Error('Database disk error during workflow step creation');
          }
          return originalStepCreate(args);
        });
        return callback(tx);
      }, ...rest);
    });

    try {
      await expect(StepResolver.getStepsForRequest(req.id)).rejects.toThrow(
        'Database disk error during workflow step creation'
      );

      // Verify transaction rolled back:
      // 1. Request workflowTemplateId is STILL the original base template
      const currentReq = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
      expect(currentReq.workflowTemplateId).toBe(originalBaseTemplateId);

      // 2. No partial dynamic template was committed
      const dynamicTmpl = await prisma.workflowTemplate.findFirst({
        where: { name: { contains: req.referenceNumber } },
        include: { steps: true },
      });
      expect(dynamicTmpl).toBeNull();
    } finally {
      txSpy.mockRestore();
    }
  });

  it('handles concurrent workflow generation calls without creating duplicate templates or duplicate steps', async () => {
    const req = await RequestService.createRequest(
      {
        title: 'Concurrent Step Resolution Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Ultrasound System',
          estimatedCost: 180000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    // Fire 8 concurrent calls to resolve steps for the same request
    const results = await Promise.all(
      Array.from({ length: 8 }).map(() => StepResolver.getStepsForRequest(req.id))
    );

    // All results must return the exact same step count
    const expectedStepCount = results[0].length;
    expect(expectedStepCount).toBeGreaterThanOrEqual(3);

    for (const stepList of results) {
      expect(stepList).toHaveLength(expectedStepCount);
      expect(stepList.map((s) => s.id)).toEqual(results[0].map((s) => s.id));
    }

    // Verify database state: exactly 1 dynamic template exists for this reference
    const templatesInDb = await prisma.workflowTemplate.findMany({
      where: { name: { contains: req.referenceNumber } },
      include: { steps: true },
    });
    expect(templatesInDb).toHaveLength(1);
    expect(templatesInDb[0].steps).toHaveLength(expectedStepCount);

    createdTemplateIds.push(templatesInDb[0].id);
  });

  it('correctly evaluates approval steps at threshold boundaries (₹1,00,000 threshold)', async () => {
    // 1. Below threshold (₹99,999): Base workflow (HOD -> Purchase Officer)
    const belowReq = await RequestService.createRequest(
      {
        title: 'Purchase Just Below Threshold',
        type: RequestType.PURCHASE,
        priority: Priority.MEDIUM,
        details: {
          itemDescription: 'Laboratory Supplies',
          estimatedCost: 99999,
        },
      },
      employeeActor
    );
    createdRequestIds.push(belowReq.id);

    const belowSteps = await StepResolver.getStepsForRequest(belowReq.id);
    expect(belowSteps).toHaveLength(2);
    expect(belowSteps[0].approverRole).toBe(UserRole.HOD);
    expect(belowSteps[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(belowSteps.some((s) => s.approverRole === UserRole.DIRECTOR)).toBe(false);

    // 2. Exactly at threshold (₹1,00,000): Base workflow (HOD -> Purchase Officer)
    const atThresholdReq = await RequestService.createRequest(
      {
        title: 'Purchase At Exact Threshold',
        type: RequestType.PURCHASE,
        priority: Priority.MEDIUM,
        details: {
          itemDescription: 'Clinic Chairs Batch',
          estimatedCost: 100000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(atThresholdReq.id);

    const atThresholdSteps = await StepResolver.getStepsForRequest(atThresholdReq.id);
    expect(atThresholdSteps).toHaveLength(2);
    expect(atThresholdSteps[0].approverRole).toBe(UserRole.HOD);
    expect(atThresholdSteps[1].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(atThresholdSteps.some((s) => s.approverRole === UserRole.DIRECTOR)).toBe(false);

    // 3. Above threshold (₹1,00,001): Dynamic workflow with Finance injected first and Director injected last
    const aboveReq = await RequestService.createRequest(
      {
        title: 'Purchase Just Above Threshold',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Advanced Surgical Lights',
          estimatedCost: 100001,
        },
      },
      employeeActor
    );
    createdRequestIds.push(aboveReq.id);

    const aboveSteps = await StepResolver.getStepsForRequest(aboveReq.id);
    expect(aboveSteps).toHaveLength(4);
    expect(aboveSteps[0].approverRole).toBe(UserRole.FINANCE_OFFICER);
    expect(aboveSteps[1].approverRole).toBe(UserRole.HOD);
    expect(aboveSteps[2].approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(aboveSteps[3].approverRole).toBe(UserRole.DIRECTOR);

    const aboveDb = await prisma.request.findUniqueOrThrow({
      where: { id: aboveReq.id },
      include: { workflowTemplate: true },
    });
    createdTemplateIds.push(aboveDb.workflowTemplateId);
  });

  it('preserves existing approval history and does not alter steps for in-flight requests', async () => {
    // 1. Create and submit high-cost request
    const req = await RequestService.createRequest(
      {
        title: 'Approval History Invariant Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'X-Ray Machine',
          estimatedCost: 200000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    // Submit request (transitions to IN_REVIEW)
    const submitted = await WorkflowEngine.submitRequest(req.id, employeeActor);
    expect(submitted.status).toBe(RequestStatus.IN_REVIEW);

    // High-cost request has Step 1 = FINANCE_OFFICER
    const dynamicTemplateId = submitted.workflowTemplateId;
    createdTemplateIds.push(dynamicTemplateId);

    // Finance Officer approves step 1
    const approved = await WorkflowEngine.approve(req.id, 'Finance Officer approved purchase', financeActor);
    expect(approved.status).toBe(RequestStatus.IN_REVIEW);

    // Verify approvalAction exists
    const approvalActions = await prisma.approvalAction.findMany({
      where: { requestId: req.id },
    });
    expect(approvalActions).toHaveLength(1);
    expect(approvalActions[0].action).toBe(ApprovalActionType.APPROVED);
    expect(approvalActions[0].actorId).toBe(financeActor.id);

    // Now call StepResolver.getStepsForRequest again
    const inFlightSteps = await StepResolver.getStepsForRequest(req.id);
    expect(inFlightSteps).toHaveLength(4);

    // Verify approval actions are completely preserved
    const actionsAfter = await prisma.approvalAction.findMany({
      where: { requestId: req.id },
    });
    expect(actionsAfter).toHaveLength(1);
    expect(actionsAfter[0].id).toBe(approvalActions[0].id);

    // Verify template steps were not mutated
    const stepsInDb = await prisma.workflowStep.findMany({
      where: { templateId: dynamicTemplateId },
    });
    expect(stepsInDb).toHaveLength(4);
  });

  it('handles repeated resolutions idempotently without unintended duplicate templates or steps', async () => {
    const req = await RequestService.createRequest(
      {
        title: 'Idempotency Resolution Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Dialysis Machine',
          estimatedCost: 300000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(req.id);

    // First call
    const steps1 = await StepResolver.getStepsForRequest(req.id);

    // Second call
    const steps2 = await StepResolver.getStepsForRequest(req.id);

    // Third call
    const steps3 = await StepResolver.getStepsForRequest(req.id);

    // All returns must match in IDs and order
    expect(steps1.map((s) => s.id)).toEqual(steps2.map((s) => s.id));
    expect(steps2.map((s) => s.id)).toEqual(steps3.map((s) => s.id));

    // Exactly one template in database
    const templates = await prisma.workflowTemplate.findMany({
      where: { name: { contains: req.referenceNumber } },
      include: { steps: true },
    });
    expect(templates).toHaveLength(1);
    expect(templates[0].steps).toHaveLength(steps1.length);

    createdTemplateIds.push(templates[0].id);
  });
});
