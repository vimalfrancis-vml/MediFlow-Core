import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { UserService } from '../../src/services/user.service';
import { WorkflowService } from '../../src/services/workflow.service';
import { WorkflowEngine, AuthUser } from '../../src/core/WorkflowEngine';
import { resolveActiveWorkflowTemplate } from '../../src/core/StepResolver';
import { RequestService } from '../../src/request/request.service';
import { documentSchema } from '../../src/validators/request.validators';
import { UserRole, RequestType, Priority, RequestStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';

describe('MediFlow Phase 4 — Security, Permissions, Edge Cases & Reliability', { timeout: 45000 }, () => {
  let activeAdmin: any;
  let hodCardio: any;
  let employeeCardio: any;
  let financeUser1: any;
  let purchaseUser: any;
  let cardioDept: any;

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
    cardioDept = await prisma.department.findUniqueOrThrow({ where: { code: 'CARD' } });
  });

  // =========================================================================
  // 1. SEPARATION OF ADMIN MANAGEMENT AUTHORITY AND BUSINESS APPROVAL
  // =========================================================================
  describe('1. ADMIN Management vs Business Approval Authority', () => {
    it('prohibits ADMIN from approving a business step without explicit override', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-ADMIN-NO-OVERRIDE-${Date.now()}`,
          title: 'Surgical Stethoscope',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Stethoscope',
              quantity: 2,
              estimatedCost: 15000,
              justification: 'Cardiology ward replacement',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio));

      // Admin attempts standard approval (no isOverride: true)
      await expect(
        WorkflowEngine.approve(req.id, 'Admin normal approval attempt', toAuthUser(activeAdmin, 'IT'))
      ).rejects.toThrow(/You cannot take action on this step/);
    });

    it('rejects ADMIN override if overrideReason is missing or empty', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-ADMIN-EMPTY-REASON-${Date.now()}`,
          title: 'ECG Monitor Supplies',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'ECG Electrodes',
              quantity: 50,
              estimatedCost: 8000,
              justification: 'Routine supply',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio));

      await expect(
        WorkflowEngine.approve(req.id, 'Admin override', toAuthUser(activeAdmin, 'IT'), {
          isOverride: true,
          overrideReason: '   ',
        })
      ).rejects.toThrow(/Administrative override requires an explicit justification reason/);
    });

    it('prohibits ADMIN override from bypassing Finance-first approval for high-value purchases (> ₹1,00,000)', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-HIGH-VALUE-FINANCE-${Date.now()}`,
          title: 'Advanced Echocardiography Machine',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Echo Ultrasound Unit',
              quantity: 1,
              estimatedCost: 450000,
              justification: 'New cardiology diagnostic suite',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio));

      // Because estimatedCost > 100000, RULE_000 injects Finance Review as the mandatory first step.
      // An Admin attempts to use administrative override to bypass Finance!
      await expect(
        WorkflowEngine.approve(req.id, 'Admin bypassing finance', toAuthUser(activeAdmin, 'IT'), {
          isOverride: true,
          overrideReason: 'Urgent hospital executive order',
        })
      ).rejects.toThrow(/Administrative override cannot bypass mandatory Finance-first approval for high-value requests/);
    });
  });

  // =========================================================================
  // 2. SELF-APPROVAL PROHIBITION UNDER ALL CIRCUMSTANCES
  // =========================================================================
  describe('2. Self-Approval Hard Prohibition', () => {
    it('prohibits requester who is an ADMIN from self-approving even with administrative override', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-ADMIN-SELF-APPROVE-${Date.now()}`,
          title: 'IT Server Rack',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: activeAdmin.id,
          departmentId: activeAdmin.departmentId,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Server Rack',
              quantity: 1,
              estimatedCost: 35000,
              justification: 'Data center rack',
            },
          },
        },
      });

      await WorkflowEngine.submitRequest(req.id, toAuthUser(activeAdmin, 'IT'));

      // Admin attempts self-approval with override
      await expect(
        WorkflowEngine.approve(req.id, 'Self-approving my own request', toAuthUser(activeAdmin, 'IT'), {
          isOverride: true,
          overrideReason: 'I am the admin',
        })
      ).rejects.toThrow(/You cannot approve your own request/);
    });
  });

  // =========================================================================
  // 3. ADMIN CREATION, PROMOTION & LAST-ACTIVE-ADMIN PROTECTION
  // =========================================================================
  describe('3. Admin Protection & Sensitive Credential Safeguards', () => {
    it('blocks deactivating or demoting the last active Administrator', async () => {
      // Find all active admins
      const activeAdmins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN, isActive: true, deletedAt: null },
      });

      // Deactivate all except one
      const survivorAdmin = activeAdmins[0]!;
      for (let i = 1; i < activeAdmins.length; i++) {
        await prisma.user.update({
          where: { id: activeAdmins[i]!.id },
          data: { isActive: false },
        });
      }

      // Attempt to deactivate the survivor admin
      await expect(
        UserService.setUserStatus(survivorAdmin.id, false)
      ).rejects.toThrow(/Cannot deactivate or remove role from the last active Administrator/);

      // Attempt to demote the survivor admin
      await expect(
        UserService.assignRole(survivorAdmin.id, UserRole.EMPLOYEE)
      ).rejects.toThrow(/Cannot deactivate or remove role from the last active Administrator/);

      // Restore other admins
      for (let i = 1; i < activeAdmins.length; i++) {
        await prisma.user.update({
          where: { id: activeAdmins[i]!.id },
          data: { isActive: true },
        });
      }
    });

    it('records ADMIN_PRIVILEGE_GRANTED audit log when promoting a user to ADMIN', async () => {
      const candidateEmail = `candidate.${Date.now()}@mediflow.com`;
      const candidate = await UserService.createUser({
        email: candidateEmail,
        employeeId: `EMP-CAND-${Date.now()}`,
        firstName: 'Elena',
        lastName: 'Rostova',
        role: UserRole.EMPLOYEE,
        departmentId: cardioDept.id,
      });

      // Promote candidate to ADMIN
      await UserService.assignRole(candidate.id, UserRole.ADMIN);

      // Verify audit log exists
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'ADMIN_PRIVILEGE_GRANTED',
          description: { contains: candidateEmail },
        },
      });

      expect(audit).not.toBeNull();
      expect(audit!.description).toContain('was granted Administrator privileges');

      // Clean up candidate
      await prisma.user.delete({ where: { id: candidate.id } });
    });

    it('guarantees passwordHash is never returned in user queries', async () => {
      const user = await UserService.getUserById(employeeCardio.id);
      expect((user as any).passwordHash).toBeUndefined();

      const users = await UserService.getUsers({ role: UserRole.ADMIN });
      users.forEach((u: any) => {
        expect(u.passwordHash).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // 4. AUTHENTICATION SECURITY & TOKEN HANDLING
  // =========================================================================
  describe('4. Authentication Security & Inactive Account Protection', () => {
    it('rejects login for deactivated accounts with HTTP 403', async () => {
      const tempEmail = `inactive.${Date.now()}@mediflow.com`;
      const tempUser = await UserService.createUser({
        email: tempEmail,
        employeeId: `EMP-INACT-${Date.now()}`,
        firstName: 'Deactivated',
        lastName: 'Staff',
        role: UserRole.EMPLOYEE,
        departmentId: cardioDept.id,
        password: 'password123',
      });

      // Deactivate user
      await UserService.setUserStatus(tempUser.id, false);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: tempEmail, password: 'password123' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/account has been deactivated/i);

      // Clean up temp user so test DB remains clean for other test suites
      await prisma.user.delete({ where: { id: tempUser.id } });
    });

    it('rejects expired JWT tokens with clear HTTP 401 error message', async () => {
      const expiredToken = jwt.sign(
        { userId: employeeCardio.id, role: employeeCardio.role },
        process.env.JWT_SECRET || 'supersecretchangeinproduction',
        { algorithm: 'HS256', expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/session has expired/i);
    });

    it('triggers HTTP 429 when rate limit threshold is exceeded on login', async () => {
      let rateLimited = false;
      // Repeatedly attempt login with x-test-rate-limit: true
      for (let i = 0; i < 12; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({ email: 'badlogin@mediflow.com', password: 'wrongpassword' });
        
        if (res.status === 429) {
          rateLimited = true;
          expect(res.body.message).toMatch(/Too many login attempts/i);
          break;
        }
      }
      expect(rateLimited).toBe(true);
    });
  });

  // =========================================================================
  // 5. DOCUMENT HANDLING & SECURITY
  // =========================================================================
  describe('5. Document & Attachment Security', () => {
    it('rejects dangerous URL schemes such as javascript:, data:, and file: in document validator', () => {
      const dangerousSchemes = [
        'javascript:alert(1)',
        'javascript:void(0)',
        'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        'file:///etc/passwd',
        'file://C:/Windows/win.ini',
        'vbscript:msgbox(1)',
      ];

      dangerousSchemes.forEach((url) => {
        const result = documentSchema.safeParse({ fileName: 'scan.pdf', url });
        expect(result.success).toBe(false);
      });
    });

    it('rejects path traversal in file names in document validator', () => {
      const traversalNames = [
        '../../secret.pdf',
        '..\\..\\boot.ini',
        '/etc/passwd',
        'sub\\folder/test.pdf',
      ];

      traversalNames.forEach((fileName) => {
        const result = documentSchema.safeParse({ fileName, url: 'https://example.com/file.pdf' });
        expect(result.success).toBe(false);
      });
    });

    it('rejects executable file extensions in document validator', () => {
      const executables = ['payload.exe', 'script.bat', 'shell.sh', 'hack.ps1', 'malware.msi'];

      executables.forEach((fileName) => {
        const result = documentSchema.safeParse({ fileName, url: 'https://example.com/file' });
        expect(result.success).toBe(false);
      });
    });

    it('successfully uploads valid document within transaction, records audit log, and allows authorized retrieval', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-DOC-UPLOAD-${Date.now()}`,
          title: 'Cardiology Equipment With Quotation',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Cardio Probes',
              quantity: 2,
              estimatedCost: 20000,
              justification: 'Probe replacement',
            },
          },
        },
      });

      // Upload valid document
      const result = await RequestService.uploadDocument(
        req.id,
        'vendor_quotation_2026.pdf',
        'https://hospital-storage.mediflow.com/docs/quotation_2026.pdf',
        toAuthUser(employeeCardio)
      );

      expect(result.success).toBe(true);

      // Verify attachment record exists
      const docs = await RequestService.getDocuments(req.id, toAuthUser(employeeCardio));
      expect(docs.length).toBe(1);
      expect(docs[0]!.fileName).toBe('vendor_quotation_2026.pdf');
      expect(docs[0]!.url).toBe('https://hospital-storage.mediflow.com/docs/quotation_2026.pdf');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { requestId: req.id, action: 'DOCUMENT_UPLOADED' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.description).toContain('vendor_quotation_2026.pdf');
    });

    it('prevents uploading documents to already cancelled or rejected requests', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-DOC-CANCELLED-${Date.now()}`,
          title: 'Cancelled Order Request',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.CANCELLED,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
        },
      });

      await expect(
        RequestService.uploadDocument(
          req.id,
          'late_quote.pdf',
          'https://storage.mediflow.com/quote.pdf',
          toAuthUser(employeeCardio)
        )
      ).rejects.toThrow(/Cannot upload documents to a cancelled or rejected request/);
    });
  });

  // =========================================================================
  // 6. DUPLICATE ACTIONS & COMPLETED REQUEST SAFEGUARDS
  // =========================================================================
  describe('6. Duplicate Actions & Invariant Safeguards', () => {
    it('prohibits submitting a request that is already IN_REVIEW or COMPLETED', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-DUP-SUBMIT-${Date.now()}`,
          title: 'Syringe Batch Order',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.DRAFT,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
          purchaseDetail: {
            create: {
              itemDescription: 'Syringes',
              quantity: 100,
              estimatedCost: 5000,
              justification: 'Ward supplies',
            },
          },
        },
      });

      // First submit: succeeds
      await WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio));

      // Second duplicate submit: fails
      await expect(
        WorkflowEngine.submitRequest(req.id, toAuthUser(employeeCardio))
      ).rejects.toThrow(/Only draft or returned requests can be submitted/);
    });

    it('prohibits cancelling an already completed (APPROVED) request', async () => {
      const template = await resolveActiveWorkflowTemplate(RequestType.PURCHASE);
      const req = await prisma.request.create({
        data: {
          referenceNumber: `REQ-P4-COMPLETED-CANCEL-${Date.now()}`,
          title: 'Already Approved Order',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          status: RequestStatus.APPROVED,
          requestedById: employeeCardio.id,
          departmentId: cardioDept.id,
          workflowTemplateId: template.id,
        },
      });

      await expect(
        WorkflowEngine.cancel(req.id, 'Trying to cancel approved order', toAuthUser(employeeCardio))
      ).rejects.toThrow(/This request cannot be cancelled at this point/);
    });
  });

  // =========================================================================
  // 7. WORKFLOW SAFETY & OUTAGE PREVENTION
  // =========================================================================
  describe('7. Workflow Safety & Active Template Preservation', () => {
    it('prevents archiving the only active workflow template for a request type', async () => {
      // Find all active templates for LEAVE
      const leaveTemplates = await prisma.workflowTemplate.findMany({
        where: { requestType: RequestType.LEAVE, deletedAt: null, NOT: { name: { startsWith: 'Dynamic:' } } },
      });

      // Archive all except one
      for (let i = 1; i < leaveTemplates.length; i++) {
        await prisma.workflowTemplate.update({
          where: { id: leaveTemplates[i]!.id },
          data: { isActive: false, deletedAt: new Date() },
        });
      }

      const solitaryTemplate = leaveTemplates[0]!;
      await prisma.workflowTemplate.update({
        where: { id: solitaryTemplate.id },
        data: { isActive: true, deletedAt: null },
      });

      // Attempt to archive the solitary template
      await expect(
        WorkflowService.archiveTemplate(solitaryTemplate.id)
      ).rejects.toThrow(/Cannot archive or deactivate the only active workflow template/);

      // Restore other leave templates
      for (let i = 1; i < leaveTemplates.length; i++) {
        await prisma.workflowTemplate.update({
          where: { id: leaveTemplates[i]!.id },
          data: { isActive: false, deletedAt: null },
        });
      }
    });
  });
});
