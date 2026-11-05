import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { StepResolver } from '../../src/core/StepResolver';
import { getJwtSecret } from '../../src/config/jwt';
import jwt from 'jsonwebtoken';
import { RequestType, RequestStatus, Priority, UserRole } from '@prisma/client';

describe('Soft-Deleted Request Protection & Lifecycle Invariants', () => {
  let employeeUser: any;
  let hodUser: any;
  let adminUser: any;

  let employeeToken: string;
  let hodToken: string;
  let adminToken: string;

  let employeeActor: AuthUser;
  let hodActor: AuthUser;
  let adminActor: AuthUser;

  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    // Find active users
    employeeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, isActive: true, deletedAt: null },
      include: { department: true },
    });

    hodUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HOD, departmentId: employeeUser.departmentId, isActive: true, deletedAt: null },
      include: { department: true },
    });

    adminUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.ADMIN, isActive: true, deletedAt: null },
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

    adminActor = {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      departmentId: adminUser.departmentId,
      departmentCode: adminUser.department.code,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
    };

    const secret = getJwtSecret();
    employeeToken = jwt.sign({ userId: employeeUser.id, role: employeeUser.role }, secret, { algorithm: 'HS256', expiresIn: '1h' });
    hodToken = jwt.sign({ userId: hodUser.id, role: hodUser.role }, secret, { algorithm: 'HS256', expiresIn: '1h' });
    adminToken = jwt.sign({ userId: adminUser.id, role: adminUser.role }, secret, { algorithm: 'HS256', expiresIn: '1h' });
  });

  afterAll(async () => {
    if (createdRequestIds.length > 0) {
      await prisma.purchaseDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.maintenanceDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.leaveDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.generalDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.approvalAction.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.notification.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.auditLog.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.comment.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.attachment.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
  });

  it('excludes soft-deleted requests from listing endpoints and direct service retrieval', async () => {
    // Create a draft request
    const created = await RequestService.createRequest(
      {
        title: 'Soft-Delete Test Item',
        type: RequestType.PURCHASE,
        priority: Priority.MEDIUM,
        details: {
          itemDescription: 'Medical Monitors',
          estimatedCost: 1500,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Verify it is listed while active
    const listBefore = await RequestService.listRequests(employeeActor);
    expect(listBefore.some((r) => r.id === created.id)).toBe(true);

    // Soft-delete the request
    await prisma.request.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });

    // 1. Fetching via API (GET /requests/:id) returns 404
    const getResEmployee = await request(app)
      .get(`/api/v1/requests/${created.id}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(getResEmployee.status).toBe(404);
    expect(getResEmployee.body.message).toBe('Request not found.');

    const getResAdmin = await request(app)
      .get(`/api/v1/requests/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getResAdmin.status).toBe(404);
    expect(getResAdmin.body.message).toBe('Request not found.');

    // 2. Fetching via RequestService.getRequestById throws 404
    await expect(RequestService.getRequestById(created.id, employeeActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // 3. Excluded from listRequests for both employee and admin
    const listAfterEmployee = await RequestService.listRequests(employeeActor);
    expect(listAfterEmployee.some((r) => r.id === created.id)).toBe(false);

    const listAfterAdmin = await RequestService.listRequests(adminActor);
    expect(listAfterAdmin.some((r) => r.id === created.id)).toBe(false);

    // Also via API GET /requests
    const apiListEmployee = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(apiListEmployee.status).toBe(200);
    expect(apiListEmployee.body.data.some((r: any) => r.id === created.id)).toBe(false);

    const apiListAdmin = await request(app)
      .get('/api/v1/requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(apiListAdmin.status).toBe(200);
    expect(apiListAdmin.body.data.some((r: any) => r.id === created.id)).toBe(false);
  });

  it('prevents submitting, editing, or cancelling a soft-deleted draft request', async () => {
    // Create a draft request
    const created = await RequestService.createRequest(
      {
        title: 'Draft Soft-Delete Test',
        type: RequestType.PURCHASE,
        priority: Priority.LOW,
        details: {
          itemDescription: 'Stethoscopes',
          estimatedCost: 2000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Soft-delete
    await prisma.request.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });

    // Edit request via API
    const editRes = await request(app)
      .put(`/api/v1/requests/${created.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Changed Title' });
    expect(editRes.status).toBe(404);
    expect(editRes.body.message).toBe('Request not found.');

    // Edit request via Service
    await expect(RequestService.editRequest(created.id, { title: 'Changed' }, employeeActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Submit request via API
    const submitRes = await request(app)
      .post(`/api/v1/requests/${created.id}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(submitRes.status).toBe(404);
    expect(submitRes.body.message).toBe('Request not found.');

    // Submit request via Service / WorkflowEngine
    await expect(WorkflowEngine.submitRequest(created.id, employeeActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Cancel request via API
    const cancelRes = await request(app)
      .post(`/api/v1/requests/${created.id}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Cancelling' });
    expect(cancelRes.status).toBe(404);
    expect(cancelRes.body.message).toBe('Request not found.');

    // Cancel request via WorkflowEngine
    await expect(WorkflowEngine.cancel(created.id, 'Cancelling', employeeActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });
  });

  it('prevents approval, rejection, returning, or forwarding on an in-review soft-deleted request', async () => {
    // Create and submit a request to put it IN_REVIEW
    const created = await RequestService.createRequest(
      {
        title: 'Review Soft-Delete Test',
        type: RequestType.PURCHASE,
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Defibrillator Batteries',
          estimatedCost: 5000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Submit into review
    const submitted = await WorkflowEngine.submitRequest(created.id, employeeActor);
    expect(submitted.status).toBe(RequestStatus.IN_REVIEW);

    // Soft-delete
    await prisma.request.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });

    // WorkflowEngine.canUserActOnRequest returns false
    const canAct = await WorkflowEngine.canUserActOnRequest(created.id, hodUser.id);
    expect(canAct).toBe(false);

    // StepResolver.getStepsForRequest throws 404
    await expect(StepResolver.getStepsForRequest(created.id)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Approve via API
    const approveRes = await request(app)
      .post(`/api/v1/requests/${created.id}/approve`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'Approved' });
    expect(approveRes.status).toBe(404);
    expect(approveRes.body.message).toBe('Request not found.');

    // Approve via WorkflowEngine
    await expect(WorkflowEngine.approve(created.id, 'Approved', hodActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Reject via API
    const rejectRes = await request(app)
      .post(`/api/v1/requests/${created.id}/reject`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'Reject reason' });
    expect(rejectRes.status).toBe(404);
    expect(rejectRes.body.message).toBe('Request not found.');

    // Reject via WorkflowEngine
    await expect(WorkflowEngine.reject(created.id, 'Reject reason', hodActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Return for correction via API
    const returnRes = await request(app)
      .post(`/api/v1/requests/${created.id}/return`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'Clarify specs' });
    expect(returnRes.status).toBe(404);
    expect(returnRes.body.message).toBe('Request not found.');

    // Return for correction via WorkflowEngine
    await expect(WorkflowEngine.returnForCorrection(created.id, 'Clarify specs', hodActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Forward via API
    const forwardRes = await request(app)
      .post(`/api/v1/requests/${created.id}/forward`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ targetUserId: adminUser.id, comment: 'Forwarding' });
    expect(forwardRes.status).toBe(404);
    expect(forwardRes.body.message).toBe('Request not found.');

    // Forward via WorkflowEngine
    await expect(WorkflowEngine.forward(created.id, adminUser.id, 'Forwarding', hodActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });

    // Eligible recipients via API
    const recipientsRes = await request(app)
      .get(`/api/v1/requests/${created.id}/recipients`)
      .set('Authorization', `Bearer ${hodToken}`);
    expect(recipientsRes.status).toBe(404);
    expect(recipientsRes.body.message).toBe('Request not found.');

    // Eligible recipients via WorkflowEngine
    await expect(WorkflowEngine.getEligibleRecipients(created.id, hodActor)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Request not found.',
    });
  });

  it('prevents adding comments, viewing comments, and viewing attachments on soft-deleted requests', async () => {
    // Create draft
    const created = await RequestService.createRequest(
      {
        title: 'Comment Attachment Soft-Delete Test',
        type: RequestType.PURCHASE,
        priority: Priority.LOW,
        details: {
          itemDescription: 'PPE Kits',
          estimatedCost: 1000,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Add comment while active
    await RequestService.addComment(created.id, 'Initial active comment', employeeActor);

    // Soft-delete
    await prisma.request.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });

    // Add comment via API
    const addCommentRes = await request(app)
      .post(`/api/v1/requests/${created.id}/comments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ comment: 'Attempting to comment on soft-deleted request' });
    expect(addCommentRes.status).toBe(404);
    expect(addCommentRes.body.message).toBe('Request not found.');

    // Get comments via API
    const getCommentsRes = await request(app)
      .get(`/api/v1/requests/${created.id}/comments`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(getCommentsRes.status).toBe(404);
    expect(getCommentsRes.body.message).toBe('Request not found.');

    // Get attachments via API
    const getAttachmentsRes = await request(app)
      .get(`/api/v1/requests/${created.id}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(getAttachmentsRes.status).toBe(404);
    expect(getAttachmentsRes.body.message).toBe('Request not found.');
  });

  it('preserves audit history and database records without hard-deleting records', async () => {
    // Create draft request
    const created = await RequestService.createRequest(
      {
        title: 'Retention Audit Test',
        type: RequestType.PURCHASE,
        priority: Priority.MEDIUM,
        details: {
          itemDescription: 'Surgical Gloves',
          estimatedCost: 800,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Verify initial audit log was created
    const initialLogs = await prisma.auditLog.findMany({
      where: { requestId: created.id },
    });
    expect(initialLogs.length).toBeGreaterThan(0);

    // Soft-delete the request
    const deletedTime = new Date();
    await prisma.request.update({
      where: { id: created.id },
      data: { deletedAt: deletedTime },
    });

    // Verify record STILL EXISTS in the database with non-null deletedAt
    const rawDbRecord = await prisma.request.findUnique({
      where: { id: created.id },
    });
    expect(rawDbRecord).not.toBeNull();
    expect(rawDbRecord?.deletedAt).not.toBeNull();
    expect(rawDbRecord?.deletedAt?.toISOString()).toBe(deletedTime.toISOString());

    // Verify AuditLog records are completely intact and not purged
    const logsAfterSoftDelete = await prisma.auditLog.findMany({
      where: { requestId: created.id },
    });
    expect(logsAfterSoftDelete.length).toBe(initialLogs.length);
  });
});
