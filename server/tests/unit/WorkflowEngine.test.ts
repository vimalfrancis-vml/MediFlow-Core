import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../src/db';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver } from '../../src/core/StepResolver';
import { RequestStatus, RequestType, Priority, UserRole, ApprovalActionType } from '@prisma/client';

describe('WorkflowEngine Integration Tests', () => {
  let employeeUser: any;
  let hodUser: any;
  let purchaseUser: any;
  let directorUser: any;
  let maintenanceUser: any;
  let template: any;

  beforeAll(async () => {
    // Fetch seeded users for testing
    employeeUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.EMPLOYEE } });
    hodUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.HOD } });
    purchaseUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.PURCHASE_OFFICER } });
    directorUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.DIRECTOR } });
    maintenanceUser = await prisma.user.findFirstOrThrow({ where: { role: UserRole.MAINTENANCE_OFFICER } });

    // Fetch the standard Purchase template
    template = await prisma.workflowTemplate.findFirstOrThrow({
      where: { requestType: RequestType.PURCHASE, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  });

  it('should run a complete Purchase Request approval workflow (low cost)', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // 1. Create a DRAFT Purchase Request
    const request = await prisma.request.create({
      data: {
        referenceNumber: `PR-TEST-${Date.now()}`,
        title: 'Office Stationary',
        type: RequestType.PURCHASE,
        priority: Priority.NORMAL,
        status: RequestStatus.DRAFT,
        requestedById: employeeUser.id,
        departmentId: employeeUser.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'Pens and notebooks',
            quantity: 50,
            estimatedCost: 2500, // Low cost
            justification: 'For admin work',
          },
        },
      },
    });

    // 2. Submit the request
    const submitted = await WorkflowEngine.submitRequest(request.id, actorEmployee);
    expect(submitted.status).toBe(RequestStatus.IN_REVIEW);
    expect(submitted.currentStepId).not.toBeNull();

    // Verify first step is HOD
    const steps = await StepResolver.getStepsForRequest(request.id);
    expect(steps[0]?.approverRole).toBe(UserRole.HOD);
    expect(submitted.currentStepId).toBe(steps[0]?.id);

    // Verify actor HOD permission
    const canHODAct = await WorkflowEngine.canUserActOnRequest(request.id, hodUser.id);
    const canPurchaseAct = await WorkflowEngine.canUserActOnRequest(request.id, purchaseUser.id);
    expect(canHODAct).toBe(true);
    expect(canPurchaseAct).toBe(false);

    // 3. HOD Approves
    const actorHod: AuthUser = {
      id: hodUser.id,
      email: hodUser.email,
      role: hodUser.role,
      departmentId: hodUser.departmentId,
      departmentCode: 'CARD',
      firstName: hodUser.firstName,
      lastName: hodUser.lastName,
    };

    const hodApproved = await WorkflowEngine.approve(request.id, 'Looks good, approved', actorHod);
    expect(hodApproved.currentStepId).toBe(steps[1]?.id); // Moves to Purchase Officer

    // 4. Purchase Officer Approves (Final Step)
    const actorPurchase: AuthUser = {
      id: purchaseUser.id,
      email: purchaseUser.email,
      role: purchaseUser.role,
      departmentId: purchaseUser.departmentId,
      departmentCode: 'PROC',
      firstName: purchaseUser.firstName,
      lastName: purchaseUser.lastName,
    };

    const finalApproved = await WorkflowEngine.approve(request.id, 'Procurement order created', actorPurchase);
    expect(finalApproved.status).toBe(RequestStatus.APPROVED);
    expect(finalApproved.currentStepId).toBeNull();
    expect(finalApproved.completedAt).not.toBeNull();

    // Clean up
    await prisma.request.delete({ where: { id: request.id } });
  }, 30000);

  it('should dynamically inject Director step for high cost purchase and allow Director to approve it', async () => {
    const actorEmployee: AuthUser = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: 'CARD',
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    // 1. Create a DRAFT High Cost Purchase Request
    const request = await prisma.request.create({
      data: {
        referenceNumber: `PR-TEST-HIGH-${Date.now()}`,
        title: 'ICU Monitor System',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        status: RequestStatus.DRAFT,
        requestedById: employeeUser.id,
        departmentId: employeeUser.departmentId,
        workflowTemplateId: template.id,
        purchaseDetail: {
          create: {
            itemDescription: 'High-end cardiac monitors',
            quantity: 2,
            estimatedCost: 350000, // High cost (> 100k) -> triggers RULE_001
            justification: 'Critical ICU upgrade',
          },
        },
      },
    });

    // 2. Submit the request
    const submitted = await WorkflowEngine.submitRequest(request.id, actorEmployee);

    // Verify step list contains 3 steps: HOD -> Purchase Officer -> Director
    const steps = await StepResolver.getStepsForRequest(request.id);
    expect(steps.length).toBe(3);
    expect(steps[0]?.approverRole).toBe(UserRole.HOD);
    expect(steps[1]?.approverRole).toBe(UserRole.PURCHASE_OFFICER);
    expect(steps[2]?.approverRole).toBe(UserRole.DIRECTOR);

    // 3. Approve as HOD
    const actorHod: AuthUser = {
      id: hodUser.id,
      email: hodUser.email,
      role: hodUser.role,
      departmentId: hodUser.departmentId,
      departmentCode: 'CARD',
      firstName: hodUser.firstName,
      lastName: hodUser.lastName,
    };
    await WorkflowEngine.approve(request.id, 'Dept needs this', actorHod);

    // 4. Approve as Purchase Officer
    const actorPurchase: AuthUser = {
      id: purchaseUser.id,
      email: purchaseUser.email,
      role: purchaseUser.role,
      departmentId: purchaseUser.departmentId,
      departmentCode: 'PROC',
      firstName: purchaseUser.firstName,
      lastName: purchaseUser.lastName,
    };
    const poApproved = await WorkflowEngine.approve(request.id, 'Quotes checked', actorPurchase);
    
    // Should advance to Director approval (step 3)
    expect(poApproved.currentStepId).toBe(steps[2]?.id);

    // 5. Approve as Director (Final)
    const actorDirector: AuthUser = {
      id: directorUser.id,
      email: directorUser.email,
      role: directorUser.role,
      departmentId: directorUser.departmentId,
      departmentCode: 'ADMIN',
      firstName: directorUser.firstName,
      lastName: directorUser.lastName,
    };
    const directorApproved = await WorkflowEngine.approve(request.id, 'Approved by Board', actorDirector);
    expect(directorApproved.status).toBe(RequestStatus.APPROVED);
    expect(directorApproved.currentStepId).toBeNull();

    // Clean up request & dynamic template
    await prisma.request.delete({ where: { id: request.id } });
    await prisma.workflowTemplate.delete({ where: { id: steps[0]!.templateId } });
  }, 30000);
});
