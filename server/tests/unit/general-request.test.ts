import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { RequestStatus, RequestType, Priority, UserRole } from '@prisma/client';
import { AppError } from '../../src/middleware/errorHandler';

describe('General Request Lifecycle & Business Rules', () => {
  let requesterCard: any;
  let itUser: any;
  let hrUser: any;
  let adminUser: any;
  let itDepartment: any;
  let hrDepartment: any;

  beforeAll(async () => {
    // 1. Fetch test users
    requesterCard = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, department: { code: 'CARD' } },
      include: { department: true },
    });

    itUser = await prisma.user.findFirstOrThrow({
      where: { email: 'hod.it@mediflow.com' },
      include: { department: true },
    });

    hrUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HR },
      include: { department: true },
    });

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
    });

    itDepartment = itUser.department;
    hrDepartment = hrUser.department;
  });

  it('should prevent self-assignment on General Request creation', async () => {
    const actorRequester: AuthUser = {
      id: requesterCard.id,
      email: requesterCard.email,
      role: requesterCard.role,
      departmentId: requesterCard.departmentId,
      departmentCode: requesterCard.department.code,
      firstName: requesterCard.firstName,
      lastName: requesterCard.lastName,
    };

    await expect(
      RequestService.createRequest(
        {
          title: 'Self rental test',
          type: RequestType.GENERAL,
          priority: Priority.NORMAL,
          details: {
            subject: 'Self rental test',
            description: 'Trying to assign to myself',
            targetUserId: requesterCard.id,
          },
        },
        actorRequester
      )
    ).rejects.toThrow('Requester cannot assign a General Request to themselves');
  });

  it('should successfully create, route to specific recipient, forward, and complete a General Request', async () => {
    const actorRequester: AuthUser = {
      id: requesterCard.id,
      email: requesterCard.email,
      role: requesterCard.role,
      departmentId: requesterCard.departmentId,
      departmentCode: requesterCard.department.code,
      firstName: requesterCard.firstName,
      lastName: requesterCard.lastName,
    };

    const actorIT: AuthUser = {
      id: itUser.id,
      email: itUser.email,
      role: itUser.role,
      departmentId: itUser.departmentId,
      departmentCode: itDepartment.code,
      firstName: itUser.firstName,
      lastName: itUser.lastName,
    };

    const actorHR: AuthUser = {
      id: hrUser.id,
      email: hrUser.email,
      role: hrUser.role,
      departmentId: hrUser.departmentId,
      departmentCode: hrDepartment.code,
      firstName: hrUser.firstName,
      lastName: hrUser.lastName,
    };

    const actorAdmin: AuthUser = {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      departmentId: adminUser.departmentId || '',
      departmentCode: 'ADMIN',
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
    };

    // 1. Create Draft General Request targeted to IT person
    const createdReq = await RequestService.createRequest(
      {
        title: '3 Cameras for Rent for 3 Days',
        type: RequestType.GENERAL,
        priority: Priority.HIGH,
        details: {
          subject: '3 Cameras for Rent for 3 Days',
          description: 'Need 3 HD Sony cameras for 3 days workshop.',
          targetDepartmentId: itDepartment.id,
          targetUserId: itUser.id,
          requiredDate: new Date(Date.now() + 86400000).toISOString(),
          endDate: new Date(Date.now() + 4 * 86400000).toISOString(),
        },
      },
      actorRequester
    );

    expect(createdReq.type).toBe(RequestType.GENERAL);
    expect(createdReq.status).toBe(RequestStatus.DRAFT);

    const detail = await prisma.generalDetail.findUniqueOrThrow({
      where: { requestId: createdReq.id },
    });
    expect(detail.subject).toBe('3 Cameras for Rent for 3 Days');
    expect(detail.targetDepartmentId).toBe(itDepartment.id);
    expect(detail.targetUserId).toBe(itUser.id);
    expect(detail.requiredDate).toBeDefined();
    expect(detail.endDate).toBeDefined();

    // 2. Submit the General Request
    const submittedReq = await WorkflowEngine.submitRequest(createdReq.id, actorRequester);
    expect(submittedReq.status).toBe(RequestStatus.IN_REVIEW);
    expect(submittedReq.assignedToUserId).toBe(itUser.id);

    // Verify routing audit log
    const submitAudit = await prisma.auditLog.findFirst({
      where: { requestId: createdReq.id, action: 'SUBMITTED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(submitAudit?.description).toContain('assigned directly to');

    // 3. Security Checks:
    // a. Requester cannot act/approve
    const canRequesterAct = await WorkflowEngine.canUserActOnRequest(createdReq.id, actorRequester.id);
    expect(canRequesterAct).toBe(false);

    // b. Admin cannot act as business approver
    const canAdminAct = await WorkflowEngine.canUserActOnRequest(createdReq.id, actorAdmin.id);
    expect(canAdminAct).toBe(false);

    // c. IT user (assigned recipient) can act
    const canITAct = await WorkflowEngine.canUserActOnRequest(createdReq.id, actorIT.id);
    expect(canITAct).toBe(true);

    // d. Non-assigned user cannot act
    const canHRActBefore = await WorkflowEngine.canUserActOnRequest(createdReq.id, actorHR.id);
    expect(canHRActBefore).toBe(false);

    // 4. Dynamic Forwarding / Reassignment:
    // IT user forwards request to HR user for cross-department equipment clearance
    const forwardedReq = await WorkflowEngine.forward(
      createdReq.id,
      hrUser.id,
      'Forwarding to HR for equipment clearance',
      actorIT
    );

    expect(forwardedReq.status).toBe(RequestStatus.IN_REVIEW);
    expect(forwardedReq.assignedToUserId).toBe(hrUser.id);

    // Check GeneralDetail updated target
    const updatedDetail = await prisma.generalDetail.findUniqueOrThrow({
      where: { requestId: createdReq.id },
    });
    expect(updatedDetail.targetUserId).toBe(hrUser.id);
    expect(updatedDetail.targetDepartmentId).toBe(hrDepartment.id);

    // Check forward audit log
    const forwardAudit = await prisma.auditLog.findFirst({
      where: { requestId: createdReq.id, action: 'FORWARDED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(forwardAudit?.description).toContain('reassigned from IT Head');

    // Now HR user can act, IT user cannot
    const canITActAfter = await WorkflowEngine.canUserActOnRequest(createdReq.id, actorIT.id);
    expect(canITActAfter).toBe(false);

    const canHRActAfter = await WorkflowEngine.canUserActOnRequest(createdReq.id, actorHR.id);
    expect(canHRActAfter).toBe(true);

    // 5. Completion / Approval by HR recipient
    const approvedReq = await WorkflowEngine.approve(
      createdReq.id,
      'Cameras reserved and approved for 3 days.',
      actorHR
    );

    expect(approvedReq.status).toBe(RequestStatus.APPROVED);

    const approveAudit = await prisma.auditLog.findFirst({
      where: { requestId: createdReq.id, action: 'APPROVED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(approveAudit?.description).toContain('Final approval completed');
  });

  it('should support department-level queue routing when target person is omitted', async () => {
    const actorRequester: AuthUser = {
      id: requesterCard.id,
      email: requesterCard.email,
      role: requesterCard.role,
      departmentId: requesterCard.departmentId,
      departmentCode: requesterCard.department.code,
      firstName: requesterCard.firstName,
      lastName: requesterCard.lastName,
    };

    const actorIT: AuthUser = {
      id: itUser.id,
      email: itUser.email,
      role: itUser.role,
      departmentId: itUser.departmentId,
      departmentCode: itDepartment.code,
      firstName: itUser.firstName,
      lastName: itUser.lastName,
    };

    // Create Draft targeted to IT department only (no specific person)
    const req = await RequestService.createRequest(
      {
        title: 'Projector for Cardiology Conference',
        type: RequestType.GENERAL,
        priority: Priority.NORMAL,
        details: {
          subject: 'Projector for Cardiology Conference',
          description: 'Need high lumen projector for cardiology auditorium conference.',
          targetDepartmentId: itDepartment.id,
        },
      },
      actorRequester
    );

    const detail = await prisma.generalDetail.findUniqueOrThrow({
      where: { requestId: req.id },
    });
    expect(detail.targetDepartmentId).toBe(itDepartment.id);
    expect(detail.targetUserId).toBeNull();

    // Submit to department queue
    const submitted = await WorkflowEngine.submitRequest(req.id, actorRequester);
    expect(submitted.status).toBe(RequestStatus.IN_REVIEW);
    expect(submitted.assignedToUserId).toBeNull();

    // IT member can act because request is routed to IT department queue
    const canITAct = await WorkflowEngine.canUserActOnRequest(req.id, actorIT.id);
    expect(canITAct).toBe(true);

    // Approving completes the request
    const approved = await WorkflowEngine.approve(req.id, 'Projector allocated.', actorIT);
    expect(approved.status).toBe(RequestStatus.APPROVED);
  });
});
