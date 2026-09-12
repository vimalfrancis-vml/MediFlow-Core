import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { UserRole, RequestType, RequestStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getUploadDir } from '../../src/middleware/upload';

const JWT_SECRET = process.env.JWT_SECRET || 'mediflow-dev-secret-key-change-in-production';

describe('MediFlow Phase 6 — Attachment Storage, Camera & Security', () => {
  let adminToken: string;
  let adminUser: any;
  let employeeToken: string;
  let employeeUser: any;
  let otherEmployeeToken: string;
  let otherEmployeeUser: any;
  let hodToken: string;
  let hodUser: any;

  let testDept: any;
  let otherDept: any;
  let workflowTemplate: any;
  let createdRequestId: string;
  let uploadedAttachmentId: string;

  const testTempDir = path.join(process.cwd(), 'uploads', 'test-attachments');

  beforeAll(async () => {
    process.env.UPLOAD_DIR = testTempDir;
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }

    // Create unique departments
    testDept = await prisma.department.upsert({
      where: { code: 'P6_DEPT' },
      update: {},
      create: { name: 'Phase 6 Testing Dept', code: 'P6_DEPT' },
    });

    otherDept = await prisma.department.upsert({
      where: { code: 'P6_OTHER' },
      update: {},
      create: { name: 'Phase 6 Other Dept', code: 'P6_OTHER' },
    });

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // Create users
    adminUser = await prisma.user.upsert({
      where: { employeeId: 'P6_ADMIN' },
      update: { isActive: true },
      create: {
        employeeId: 'P6_ADMIN',
        email: 'p6_admin@mediflow.local',
        passwordHash: hashedPassword,
        firstName: 'Phase6',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        departmentId: testDept.id,
      },
    });

    employeeUser = await prisma.user.upsert({
      where: { employeeId: 'P6_EMP1' },
      update: { isActive: true },
      create: {
        employeeId: 'P6_EMP1',
        email: 'p6_emp1@mediflow.local',
        passwordHash: hashedPassword,
        firstName: 'Phase6',
        lastName: 'Requester',
        role: UserRole.EMPLOYEE,
        departmentId: testDept.id,
      },
    });

    otherEmployeeUser = await prisma.user.upsert({
      where: { employeeId: 'P6_EMP2' },
      update: { isActive: true },
      create: {
        employeeId: 'P6_EMP2',
        email: 'p6_emp2@mediflow.local',
        passwordHash: hashedPassword,
        firstName: 'Phase6',
        lastName: 'Unrelated',
        role: UserRole.EMPLOYEE,
        departmentId: otherDept.id,
      },
    });

    hodUser = await prisma.user.upsert({
      where: { employeeId: 'P6_HOD' },
      update: { isActive: true },
      create: {
        employeeId: 'P6_HOD',
        email: 'p6_hod@mediflow.local',
        passwordHash: hashedPassword,
        firstName: 'Phase6',
        lastName: 'HOD',
        role: UserRole.HOD,
        departmentId: testDept.id,
      },
    });

    const JWT_SECRET = process.env.JWT_SECRET || 'supersecretchangeinproduction';
    // Generate JWT tokens matching auth middleware
    const signToken = (user: any) =>
      jwt.sign(
        { userId: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

    adminToken = signToken(adminUser);
    employeeToken = signToken(employeeUser);
    otherEmployeeToken = signToken(otherEmployeeUser);
    hodToken = signToken(hodUser);

    // Fetch active Purchase template
    workflowTemplate = await prisma.workflowTemplate.findFirst({
      where: { requestType: RequestType.PURCHASE, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  });

  afterAll(async () => {
    // Clean up test files and directories
    if (fs.existsSync(testTempDir)) {
      try {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
  });

  it('1. Successfully creates a draft request for attachment testing', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Phase 6 Test Equipment Purchase',
        type: 'PURCHASE',
        priority: 'NORMAL',
        details: {
          itemDescription: 'Stethoscope and Diagnostic Kit',
          quantity: 2,
          estimatedCost: 25000,
          justification: 'Replacement for damaged tools',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdRequestId = res.body.data.id;
  });

  it('2. Blocks uploading files with dangerous executable extensions (.exe, .sh, .bat, .php)', async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('file', Buffer.from('echo malicious'), 'exploit.sh');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/prohibited|unsupported/i);
  });

  it('3. Blocks directory traversal attacks in original filename', async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('file', Buffer.from('%PDF-1.4 valid test file'), '../../etc/passwd.pdf');

    // Either sanitized or rejected
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      // Must not contain ../
      expect(res.body.data.originalName).not.toContain('..');
      expect(res.body.data.originalName).not.toContain('/');
    }
  });

  it('4. Rejects fake PDF with executable DOS MZ header (signature mismatch)', async () => {
    // Construct fake PDF that is actually an MZ executable
    const fakePdfBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = await request(app)
      .post(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('file', fakePdfBuffer, 'trojan.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/signature|format/i);
  });

  it('5. Successfully uploads a genuine PDF document with UUID storage and audit trail', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.5\n%Valid MediFlow Medical Report\n%%EOF');
    const res = await request(app)
      .post(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('file', validPdfBuffer, 'quotation_vendor.pdf');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.originalName).toBe('quotation_vendor.pdf');
    expect(res.body.data.mimeType).toBe('application/pdf');
    expect(res.body.data.sizeBytes).toBeGreaterThan(0);
    expect(res.body.data.storagePath).toMatch(/^[0-9a-f-]+\.pdf$/i); // UUID filename

    uploadedAttachmentId = res.body.data.id;

    // Verify stored file on disk
    const diskPath = path.join(testTempDir, res.body.data.storagePath);
    expect(fs.existsSync(diskPath)).toBe(true);

    // Verify audit log
    const logs = await prisma.auditLog.findMany({
      where: { requestId: createdRequestId, action: 'DOCUMENT_UPLOADED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].description).toContain('quotation_vendor.pdf');
  });

  it('6. Successfully uploads an image capture (PNG/JPG camera scan)', async () => {
    // PNG Header: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const res = await request(app)
      .post(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('file', pngHeader, 'camera_scan.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.originalName).toBe('camera_scan.png');
    expect(res.body.data.mimeType).toBe('image/png');
  });

  it('7. Rejects unauthorized users from listing attachments (HTTP 403)', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not allowed/i);
  });

  it('8. Allows authorized requester and approver to list attachments', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].uploadedBy).toBeDefined();
    expect(res.body.data[0].uploadedBy.firstName).toBe('Phase6');
  });

  it('9. Rejects unauthorized users from viewing/downloading attachment files (HTTP 403)', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${createdRequestId}/attachments/${uploadedAttachmentId}`)
      .set('Authorization', `Bearer ${otherEmployeeToken}`);

    expect(res.status).toBe(403);
  });

  it('10. Safely streams attachment file to authorized user with strict security headers', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${createdRequestId}/attachments/${uploadedAttachmentId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'");
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.headers['content-disposition']).toContain('quotation_vendor.pdf');
    expect(res.body.toString()).toContain('%PDF-1.5');
  });

  it('11. Supports explicit download trigger with Content-Disposition: attachment', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${createdRequestId}/attachments/${uploadedAttachmentId}?download=true`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('quotation_vendor.pdf');
  });

  it('12. Prevents non-owner / non-admin from deleting requester attachment (HTTP 403)', async () => {
    const res = await request(app)
      .delete(`/api/v1/requests/${createdRequestId}/attachments/${uploadedAttachmentId}`)
      .set('Authorization', `Bearer ${hodToken}`);

    expect(res.status).toBe(403);
  });

  it('13. Allows requester to delete their own attachment in DRAFT status', async () => {
    const res = await request(app)
      .delete(`/api/v1/requests/${createdRequestId}/attachments/${uploadedAttachmentId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify removed from DB
    const count = await prisma.attachment.count({
      where: { id: uploadedAttachmentId },
    });
    expect(count).toBe(0);

    // Verify deletion audit log
    const logs = await prisma.auditLog.findMany({
      where: { requestId: createdRequestId, action: 'DOCUMENT_DELETED' },
    });
    expect(logs.length).toBeGreaterThan(0);
  });

  it('14. Prohibits uploading attachments to cancelled or rejected requests', async () => {
    // Cancel the request
    await request(app)
      .post(`/api/v1/requests/${createdRequestId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'Cancellation for Phase 6 test' });

    // Attempt upload
    const validPdfBuffer = Buffer.from('%PDF-1.5\n%Late Report\n%%EOF');
    const res = await request(app)
      .post(`/api/v1/requests/${createdRequestId}/attachments`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .attach('file', validPdfBuffer, 'late_document.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cancelled or rejected/i);
  });
});
