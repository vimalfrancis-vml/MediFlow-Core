import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { AuthUser } from '../../src/core/WorkflowEngine';
import { getJwtSecret } from '../../src/config/jwt';
import jwt from 'jsonwebtoken';
import { RequestType, Priority, UserRole } from '@prisma/client';

describe('Purchase Request Validation & Integrity', () => {
  let employeeUser: any;
  let employeeToken: string;
  let actorEmployee: AuthUser;
  let targetUser: any;
  let targetDept: any;
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, isActive: true, deletedAt: null },
      include: { department: true },
    });

    targetUser = await prisma.user.findFirstOrThrow({
      where: { id: { not: employeeUser.id }, role: { not: UserRole.ADMIN }, isActive: true, deletedAt: null },
      include: { department: true },
    });

    targetDept = await prisma.department.findFirstOrThrow({
      where: { isActive: true },
    });

    actorEmployee = {
      id: employeeUser.id,
      email: employeeUser.email,
      role: employeeUser.role,
      departmentId: employeeUser.departmentId,
      departmentCode: employeeUser.department.code,
      firstName: employeeUser.firstName,
      lastName: employeeUser.lastName,
    };

    employeeToken = jwt.sign(
      { userId: employeeUser.id, role: employeeUser.role },
      getJwtSecret(),
      { algorithm: 'HS256', expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (createdRequestIds.length > 0) {
      await prisma.purchaseDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.maintenanceDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.leaveDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.generalDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.auditLog.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
  });

  // =========================================================================
  // 1. REJECTING MISSING OR INCOMPLETE PURCHASE DETAILS (HTTP API & SERVICE)
  // =========================================================================
  describe('1. Missing or Incomplete Purchase Details', () => {
    it('rejects purchase request when details object is completely omitted via HTTP API (HTTP 400)', async () => {
      const initialCount = await prisma.request.count({ where: { requestedById: employeeUser.id } });

      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Surgical Gloves Procurement',
          type: 'PURCHASE',
          priority: 'NORMAL',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      // Verify no partial record created
      const currentCount = await prisma.request.count({ where: { requestedById: employeeUser.id } });
      expect(currentCount).toBe(initialCount);
    });

    it('rejects purchase request when details object is omitted in RequestService.createRequest', async () => {
      const initialCount = await prisma.request.count({ where: { requestedById: employeeUser.id } });

      await expect(
        RequestService.createRequest(
          {
            title: 'Surgical Gloves Procurement',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
          },
          actorEmployee
        )
      ).rejects.toThrow(/Details are required for Purchase requests/i);

      // Verify no partial record created
      const currentCount = await prisma.request.count({ where: { requestedById: employeeUser.id } });
      expect(currentCount).toBe(initialCount);
    });

    it('rejects purchase request when itemDescription is omitted or empty (HTTP 400)', async () => {
      const resMissing = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Ultrasound Probe Supplies',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            estimatedCost: 25000,
            quantity: 2,
          },
        });

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.success).toBe(false);

      const resWhitespace = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Ultrasound Probe Supplies',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: '    ',
            estimatedCost: 25000,
          },
        });

      expect(resWhitespace.status).toBe(400);
      expect(resWhitespace.body.success).toBe(false);
    });

    it('rejects purchase request when itemDescription is omitted in RequestService.createRequest', async () => {
      await expect(
        RequestService.createRequest(
          {
            title: 'Ultrasound Probe Supplies',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
            details: {
              itemDescription: '',
              estimatedCost: 25000,
            },
          },
          actorEmployee
        )
      ).rejects.toThrow(/Item description is required/i);
    });

    it('rejects purchase request when estimatedCost is omitted or undefined (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'ECG Thermal Paper Roll',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'Thermal Paper Roll Pack of 50',
            quantity: 5,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects purchase request when estimatedCost is omitted in RequestService.createRequest', async () => {
      await expect(
        RequestService.createRequest(
          {
            title: 'ECG Thermal Paper Roll',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
            details: {
              itemDescription: 'Thermal Paper Roll Pack of 50',
              quantity: 5,
            },
          },
          actorEmployee
        )
      ).rejects.toThrow(/Estimated cost is required/i);
    });
  });

  // =========================================================================
  // 2. INVALID ESTIMATED COST AND QUANTITY VALUES
  // =========================================================================
  describe('2. Invalid Estimated Cost & Quantity Values', () => {
    it('rejects zero estimated cost (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Zero Cost Test Item',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'Sample Kit',
            estimatedCost: 0,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      await expect(
        RequestService.createRequest(
          {
            title: 'Zero Cost Test Item',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
            details: {
              itemDescription: 'Sample Kit',
              estimatedCost: 0,
            },
          },
          actorEmployee
        )
      ).rejects.toThrow(/Estimated cost must be greater than zero/i);
    });

    it('rejects negative estimated cost (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Negative Cost Test Item',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'Medical Supplies',
            estimatedCost: -500,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      await expect(
        RequestService.createRequest(
          {
            title: 'Negative Cost Test Item',
            type: RequestType.PURCHASE,
            priority: Priority.NORMAL,
            details: {
              itemDescription: 'Medical Supplies',
              estimatedCost: -500,
            },
          },
          actorEmployee
        )
      ).rejects.toThrow(/Estimated cost must be greater than zero/i);
    });

    it('rejects non-numeric estimated cost (HTTP 400)', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'String Cost Test Item',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'Medical Supplies',
            estimatedCost: 'fifty-thousand',
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects invalid quantity values (zero, negative, or decimal)', async () => {
      const resZero = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Zero Quantity Test',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'Test Syringes',
            estimatedCost: 1000,
            quantity: 0,
          },
        });

      expect(resZero.status).toBe(400);

      const resNegative = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Negative Quantity Test',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'Test Syringes',
            estimatedCost: 1000,
            quantity: -5,
          },
        });

      expect(resNegative.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. VALID PURCHASE REQUEST CREATION & EDITING
  // =========================================================================
  describe('3. Valid Purchase Request Lifecycle', () => {
    it('successfully creates a valid purchase request with full details via HTTP API (HTTP 201)', async () => {
      const res = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Cardiac Stethoscope Model X',
          type: 'PURCHASE',
          priority: 'NORMAL',
          details: {
            itemDescription: 'High-Acoustic Electronic Stethoscope',
            quantity: 2,
            estimatedCost: 18500.5,
            justification: 'Replacement for broken ward diagnostic tools',
            vendorName: 'MediEquip Pvt Ltd',
            budgetCode: 'CARD-EQ-2026',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const reqId = res.body.data.id;
      createdRequestIds.push(reqId);

      // Verify DB record and relations
      const saved = await prisma.request.findUniqueOrThrow({
        where: { id: reqId },
        include: { purchaseDetail: true },
      });

      expect(saved.type).toBe('PURCHASE');
      expect(saved.purchaseDetail).not.toBeNull();
      expect(saved.purchaseDetail!.itemDescription).toBe('High-Acoustic Electronic Stethoscope');
      expect(saved.purchaseDetail!.quantity).toBe(2);
      expect(Number(saved.purchaseDetail!.estimatedCost)).toBe(18500.5);
      expect(saved.purchaseDetail!.justification).toBe('Replacement for broken ward diagnostic tools');
      expect(saved.purchaseDetail!.vendorName).toBe('MediEquip Pvt Ltd');
      expect(saved.purchaseDetail!.budgetCode).toBe('CARD-EQ-2026');
    });

    it('successfully creates a valid purchase request via RequestService.createRequest', async () => {
      const req = await RequestService.createRequest(
        {
          title: 'ECG Electrodes Batch',
          type: RequestType.PURCHASE,
          priority: Priority.HIGH,
          details: {
            itemDescription: 'Disposable ECG Electrodes 100pk',
            quantity: 10,
            estimatedCost: 4500,
            justification: 'Emergency department consumable refill',
          },
        },
        actorEmployee
      );

      createdRequestIds.push(req.id);

      const saved = await prisma.request.findUniqueOrThrow({
        where: { id: req.id },
        include: { purchaseDetail: true },
      });

      expect(saved.purchaseDetail).not.toBeNull();
      expect(saved.purchaseDetail!.itemDescription).toBe('Disposable ECG Electrodes 100pk');
      expect(Number(saved.purchaseDetail!.estimatedCost)).toBe(4500);
      expect(saved.purchaseDetail!.quantity).toBe(10);
    });

    it('validates editing an existing draft purchase request', async () => {
      const req = await RequestService.createRequest(
        {
          title: 'Editable Draft Purchase',
          type: RequestType.PURCHASE,
          priority: Priority.NORMAL,
          details: {
            itemDescription: 'Draft Stethoscope',
            quantity: 1,
            estimatedCost: 10000,
            justification: 'Initial Draft',
          },
        },
        actorEmployee
      );
      createdRequestIds.push(req.id);

      // 1. Invalid edit: negative cost -> rejected
      const resBadCost = await request(app)
        .put(`/api/v1/requests/${req.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Updated Purchase',
          details: {
            estimatedCost: -50,
          },
        });
      expect(resBadCost.status).toBe(400);

      // 2. Invalid edit: empty item description -> rejected
      const resEmptyDesc = await request(app)
        .put(`/api/v1/requests/${req.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Updated Purchase',
          details: {
            itemDescription: '   ',
          },
        });
      expect(resEmptyDesc.status).toBe(400);

      // 3. Valid edit -> accepted
      const resValid = await request(app)
        .put(`/api/v1/requests/${req.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Updated Purchase Title',
          details: {
            itemDescription: 'Updated Stethoscope V2',
            estimatedCost: 12500,
            quantity: 3,
            justification: 'Approved department upgrade',
          },
        });
      expect(resValid.status).toBe(200);

      const after = await prisma.purchaseDetail.findUniqueOrThrow({ where: { requestId: req.id } });
      expect(after.itemDescription).toBe('Updated Stethoscope V2');
      expect(Number(after.estimatedCost)).toBe(12500);
      expect(after.quantity).toBe(3);
    });
  });

  // =========================================================================
  // 4. REGRESSION VERIFICATION: MAINTENANCE, LEAVE, AND GENERAL REQUESTS
  // =========================================================================
  describe('4. Regression Checks for Other Request Types', () => {
    it('creates a valid MAINTENANCE request and preserves required validation', async () => {
      // 1. Valid Maintenance Request
      const resValid = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Defibrillator Battery Replacement',
          type: 'MAINTENANCE',
          priority: 'HIGH',
          details: {
            equipmentName: 'Lifepak 15 Defibrillator',
            location: 'ICU Ward 3',
            urgencyLevel: 'HIGH',
            issueDescription: 'Battery failure alert blinking',
            notes: 'Priority replacement required.',
          },
        });

      expect(resValid.status).toBe(201);
      const maintId = resValid.body.data.id;
      createdRequestIds.push(maintId);

      const maintDetail = await prisma.maintenanceDetail.findUniqueOrThrow({ where: { requestId: maintId } });
      expect(maintDetail.equipmentName).toBe('Lifepak 15 Defibrillator');
      expect(maintDetail.location).toBe('ICU Ward 3');

      // 2. Missing details for Maintenance -> rejected
      await expect(
        RequestService.createRequest(
          {
            title: 'Maintenance No Details',
            type: RequestType.MAINTENANCE,
            priority: Priority.NORMAL,
          },
          actorEmployee
        )
      ).rejects.toThrow(/Details are required for Maintenance requests/i);
    });

    it('creates a valid LEAVE request and preserves required validation', async () => {
      // 1. Valid Leave Request
      const resValid = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Annual Vacation Leave',
          type: 'LEAVE',
          priority: 'NORMAL',
          details: {
            leaveType: 'Annual',
            startDate: '2027-09-01',
            endDate: '2027-09-07',
            reason: 'Family vacation',
            coveringStaff: 'Nurse Sarah',
          },
        });

      expect(resValid.status).toBe(201);
      const leaveId = resValid.body.data.id;
      createdRequestIds.push(leaveId);

      const leaveDetail = await prisma.leaveDetail.findUniqueOrThrow({ where: { requestId: leaveId } });
      expect(leaveDetail.leaveType).toBe('Annual');
      expect(leaveDetail.totalDays).toBe(7);

      // 2. Missing details for Leave -> rejected
      await expect(
        RequestService.createRequest(
          {
            title: 'Leave No Details',
            type: RequestType.LEAVE,
            priority: Priority.NORMAL,
          },
          actorEmployee
        )
      ).rejects.toThrow(/Details are required for Leave requests/i);
    });

    it('creates a valid GENERAL request and preserves required validation', async () => {
      // 1. Valid General Request
      const resValid = await request(app)
        .post('/api/v1/requests')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          title: 'Cardiology Access Badge Re-issuance',
          type: 'GENERAL',
          priority: 'NORMAL',
          details: {
            subject: 'Cardiology Access Badge Re-issuance',
            description: 'Requesting updated RFID access card for cath lab security door',
            targetDepartmentId: targetDept.id,
            targetUserId: targetUser.id,
          },
        });

      expect(resValid.status).toBe(201);
      const genId = resValid.body.data.id;
      createdRequestIds.push(genId);

      const genDetail = await prisma.generalDetail.findUniqueOrThrow({ where: { requestId: genId } });
      expect(genDetail.subject).toBe('Cardiology Access Badge Re-issuance');
      expect(genDetail.description).toContain('RFID access card');

      // 2. Missing details for General -> rejected
      await expect(
        RequestService.createRequest(
          {
            title: 'General No Details',
            type: RequestType.GENERAL,
            priority: Priority.NORMAL,
          },
          actorEmployee
        )
      ).rejects.toThrow(/Details are required for General requests/i);
    });
  });
});

