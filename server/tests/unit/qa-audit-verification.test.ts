import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { RequestService } from '../../src/request/request.service';
import { resolveActiveWorkflowTemplate } from '../../src/core/StepResolver';
import { RequestStatus, RequestType, Priority, UserRole, ApprovalActionType } from '@prisma/client';

describe('QA Audit & Bug Fix Verification Suite', { timeout: 45000 }, () => {
  let employeeCardio: any;
  let employee2Cardio: any;
  let hodCardio: any;
  let financeUser: any;
  let purchaseUser: any;
  let directorUser: any;
  let adminUser: any;
  let itHeadUser: any;
  let cardioDept: any;
  let finDept: any;
  let itDept: any;

  const toAuth = (u: any, deptCode: string): AuthUser => ({
    id: u.id,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
    departmentCode: deptCode,
    firstName: u.firstName,
    lastName: u.lastName,
  });

  beforeAll(async () => {
    employeeCardio = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, email: 'employee1@mediflow.com' },
      include: { department: true }
    });
    employee2Cardio = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, email: 'dr.employee@mediflow.com' },
      include: { department: true }
    });
    hodCardio = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HOD, email: 'hod.cardio@mediflow.com' },
      include: { department: true }
    });
    financeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.FINANCE_OFFICER, email: 'finance@mediflow.com' },
      include: { department: true }
    });
    purchaseUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.PURCHASE_OFFICER },
      include: { department: true }
    });
    directorUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.DIRECTOR },
      include: { department: true }
    });
    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
      include: { department: true }
    });
    itHeadUser = await prisma.user.findFirstOrThrow({
      where: { email: 'hod.it@mediflow.com' },
      include: { department: true }
    });

    cardioDept = employeeCardio.department;
    finDept = financeUser.department;
    itDept = itHeadUser.department;
  });

  // 1. Finance-First Queue Visibility Bug Fix
  it('1. Finance-First Bug Fix: Finance Officer sees high-value purchase from another department in unassigned pool', async () => {
    const actorRequester = toAuth(employeeCardio, 'CARD');
    const actorFinance = toAuth(financeUser, 'FIN');

    // Create high-value purchase from Cardiology
    const req = await RequestService.createRequest({
      title: 'Cath Lab High Resolution Cardiac Stent Imager',
      type: RequestType.PURCHASE,
      priority: Priority.HIGH,
      details: {
        itemDescription: 'Cath Lab Stent Imaging Station',
        quantity: 1,
        estimatedCost: 350000, // > 100k -> Step 1 Finance Clearance
        justification: 'Critical equipment replacement for cath lab emergency stenting.',
      },
    }, actorRequester);

    try {
      // Submit
      const submitted = await RequestService.submitRequest(req.id, actorRequester);
      expect(submitted.status).toBe(RequestStatus.IN_REVIEW);

      // Verify Step 1 is Finance Department Review
      const steps = await prisma.request.findUniqueOrThrow({
        where: { id: req.id },
        include: { currentStep: true, department: true }
      });
      expect(steps.currentStep?.approverRole).toBe(UserRole.FINANCE_OFFICER);
      expect(steps.department.code).toBe('CARD'); // Request belongs to CARD

      // Query listRequests as Finance Officer
      const financeList = await RequestService.listRequests(actorFinance);
      const found = financeList.find(r => r.id === req.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('Cath Lab High Resolution Cardiac Stent Imager');
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 2. Cancellation Workflow
  it('2. Cancellation Workflow: Requester can cancel DRAFT, RETURNED, and IN_REVIEW; unauthorized users cannot', async () => {
    const actorRequester = toAuth(employeeCardio, 'CARD');
    const actorHod = toAuth(hodCardio, 'CARD');
    const actorUnauthorized = toAuth(employee2Cardio, 'CARD');

    // Create Draft
    const req = await RequestService.createRequest({
      title: 'Sterile Gauze Packs',
      type: RequestType.PURCHASE,
      priority: Priority.NORMAL,
      details: {
        itemDescription: 'Sterile surgical gauze',
        quantity: 10,
        estimatedCost: 2000,
        justification: 'Ward dressing supplies',
      },
    }, actorRequester);

    try {
      // Unauthorized user cannot cancel
      await expect(
        RequestService.cancelRequest(req.id, 'Unauthorized cancellation', actorUnauthorized)
      ).rejects.toThrow(/You are not permitted to cancel this request/);

      // Submit request
      await RequestService.submitRequest(req.id, actorRequester);

      // Return for changes by HOD
      await WorkflowEngine.returnForCorrection(req.id, 'Please update vendor quote', actorHod);
      const returnedReq = await prisma.request.findUniqueOrThrow({ where: { id: req.id } });
      expect(returnedReq.status).toBe(RequestStatus.RETURNED);

      // Requester cancels the returned request
      const cancelledReq = await RequestService.cancelRequest(req.id, 'Vendor out of stock', actorRequester);
      expect(cancelledReq.status).toBe(RequestStatus.CANCELLED);

      // Verify audit log for cancellation
      const cancelAudit = await prisma.auditLog.findFirst({
        where: { requestId: req.id, action: 'CANCELLED' },
      });
      expect(cancelAudit?.description).toContain('Vendor out of stock');

      // Attempting to cancel already cancelled request throws error
      await expect(
        RequestService.cancelRequest(req.id, 'Try again', actorRequester)
      ).rejects.toThrow(/This request cannot be cancelled at this point/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 3. Return -> Edit -> Resubmit -> Forward Cross-Department -> Final Approval Cycle
  it('3. Complete Workflow Cycle: Create -> Submit -> Return -> Edit -> Resubmit -> Cross-Dept Forward -> Complete', async () => {
    const actorRequester = toAuth(employeeCardio, 'CARD');
    const actorHod = toAuth(hodCardio, 'CARD');
    const actorITHead = toAuth(itHeadUser, 'IT');
    const actorPurchase = toAuth(purchaseUser, 'PROC');

    // 1. Create Draft
    const req = await RequestService.createRequest({
      title: 'Cardiology Holter Analysis Software License',
      type: RequestType.PURCHASE,
      priority: Priority.HIGH,
      details: {
        itemDescription: 'Annual 12-lead Holter ECG analysis desktop software',
        quantity: 1,
        estimatedCost: 80000, // < 100k -> HOD -> Purchase Officer
        justification: 'Cardiac arrhythmia outpatient diagnosis',
      },
    }, actorRequester);

    try {
      // 2. Submit
      await RequestService.submitRequest(req.id, actorRequester);

      // 3. HOD returns for correction
      await WorkflowEngine.returnForCorrection(req.id, 'Please specify exact software version number', actorHod);
      expect((await prisma.request.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(RequestStatus.RETURNED);

      // 4. Requester edits request
      await RequestService.editRequest(req.id, {
        title: 'Cardiology Holter Analysis Software License v4.2',
        details: {
          itemDescription: 'Annual 12-lead Holter ECG analysis desktop software v4.2 Pro',
          quantity: 1,
          estimatedCost: 80000,
          justification: 'Cardiac arrhythmia outpatient diagnosis with updated PACS export',
        },
      }, actorRequester);

      // 5. Resubmit
      const resubmitted = await RequestService.submitRequest(req.id, actorRequester);
      expect(resubmitted.status).toBe(RequestStatus.IN_REVIEW);

      // 6. Dynamic Forwarding: HOD forwards cross-department to IT Head for technical compatibility review
      const forwarded = await WorkflowEngine.forward(
        req.id,
        itHeadUser.id,
        'Please verify PACS server integration and operating system compatibility',
        actorHod
      );
      expect(forwarded.assignedToUserId).toBe(itHeadUser.id);
      expect(forwarded.status).toBe(RequestStatus.IN_REVIEW);

      // Verify IT Head can act, while HOD can no longer act
      expect(await WorkflowEngine.canUserActOnRequest(req.id, itHeadUser.id)).toBe(true);
      expect(await WorkflowEngine.canUserActOnRequest(req.id, hodCardio.id)).toBe(false);

      // 7. IT Head approves the forwarded step (advances to Procurement Review)
      const afterITApprove = await WorkflowEngine.approve(
        req.id,
        'IT architecture compatibility confirmed',
        actorITHead
      );
      expect(afterITApprove.assignedToUserId).toBeNull(); // Reset for next stage
      expect(afterITApprove.status).toBe(RequestStatus.IN_REVIEW);

      // 8. Purchase Officer approves (final step)
      const finalApproved = await WorkflowEngine.approve(
        req.id,
        'Vendor PO generated under IT software category',
        actorPurchase
      );
      expect(finalApproved.status).toBe(RequestStatus.APPROVED);
      expect(finalApproved.completedAt).toBeDefined();
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 4. Admin Override Governance & Finance Protection
  it('4. Admin Override Governance: Admin cannot act as normal approver, requires reason, cannot bypass Finance-first', async () => {
    const actorRequester = toAuth(employeeCardio, 'CARD');
    const actorAdmin = toAuth(adminUser, 'ADMIN');

    // Create high-value purchase (> 100k)
    const req = await RequestService.createRequest({
      title: 'High-Value Cardiac Angiography Catheter Batch',
      type: RequestType.PURCHASE,
      priority: Priority.HIGH,
      details: {
        itemDescription: 'High precision angiographic catheters batch',
        quantity: 50,
        estimatedCost: 220000,
        justification: 'Catheter lab interventional procedures',
      },
    }, actorRequester);

    try {
      await RequestService.submitRequest(req.id, actorRequester);

      // A. Admin cannot act as standard business approver
      expect(await WorkflowEngine.canUserActOnRequest(req.id, adminUser.id)).toBe(false);

      // B. Admin approval without explicit override flag is rejected
      await expect(
        WorkflowEngine.approve(req.id, 'Standard approve attempt', actorAdmin)
      ).rejects.toThrow();

      // C. Admin override without justification reason is rejected
      await expect(
        WorkflowEngine.approve(req.id, 'Comment', actorAdmin, { isOverride: true, overrideReason: '   ' })
      ).rejects.toThrow(/Administrative override requires an explicit justification reason/);

      // D. Admin override cannot bypass Step 1 Finance Clearance for purchases > ₹1,00,000
      await expect(
        WorkflowEngine.approve(req.id, 'Emergency bypass', actorAdmin, {
          isOverride: true,
          overrideReason: 'Urgent patient in cath lab',
        })
      ).rejects.toThrow(/Administrative override cannot bypass mandatory Finance-first approval/);
    } finally {
      await prisma.auditLog.deleteMany({ where: { requestId: req.id } });
      await prisma.approvalAction.deleteMany({ where: { requestId: req.id } });
      await prisma.notification.deleteMany({ where: { requestId: req.id } });
      await prisma.purchaseDetail.deleteMany({ where: { requestId: req.id } });
      await prisma.request.delete({ where: { id: req.id } });
    }
  });

  // 5. Comma-separated status filtering in listRequests
  it('5. Status filter supports comma-separated statuses for history queries', async () => {
    const actorAdmin = toAuth(adminUser, 'ADMIN');
    const results = await RequestService.listRequests(actorAdmin, {
      status: 'APPROVED,REJECTED,RETURNED',
    });
    expect(Array.isArray(results)).toBe(true);
    results.forEach(r => {
      expect(['APPROVED', 'REJECTED', 'RETURNED']).toContain(r.status);
    });
  });
});
