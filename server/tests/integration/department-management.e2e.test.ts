import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UserRole } from '@prisma/client';

describe('Department Management API E2E Scenarios', { timeout: 30000 }, () => {
  let cardioHod: any;
  let cardioDept: any;
  let cardioHodToken: string;
  let adminToken: string;
  let createdEmpId: string;
  let createdPositionId: string;

  beforeAll(async () => {
    cardioDept = await prisma.department.findFirst({
      where: { code: 'CARD', isActive: true },
    });
    cardioHod = await prisma.user.findFirst({
      where: { role: UserRole.HOD, departmentId: cardioDept.id, isActive: true },
    });
    const adminUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    const jwtSecret = process.env.JWT_SECRET || 'supersecretchangeinproduction';
    cardioHodToken = jwt.sign(
      { userId: cardioHod.id, role: cardioHod.role, tokenVersion: cardioHod.tokenVersion },
      jwtSecret,
      { expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { userId: adminUser!.id, role: adminUser!.role, tokenVersion: adminUser!.tokenVersion },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (createdEmpId) {
      await prisma.employeePosition.deleteMany({ where: { userId: createdEmpId } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { actorId: createdEmpId } }).catch(() => {});
      await prisma.user.delete({ where: { id: createdEmpId } }).catch(() => {});
    }
    if (createdPositionId) {
      await prisma.employeePosition.deleteMany({ where: { positionId: createdPositionId } }).catch(() => {});
      await prisma.position.delete({ where: { id: createdPositionId } }).catch(() => {});
    }
  });

  it('1. HOD can fetch own department employees and KPI stats', async () => {
    const res = await request(app)
      .get('/api/v1/department-management/employees')
      .set('Authorization', `Bearer ${cardioHodToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.stats.totalEmployees).toBeGreaterThanOrEqual(1);
    expect(res.body.data.department.id).toBe(cardioDept.id);
  });

  it('2. HOD can create a new hospital position', async () => {
    const res = await request(app)
      .post('/api/v1/department-management/positions')
      .set('Authorization', `Bearer ${cardioHodToken}`)
      .send({
        name: `Cardio Tech ${Date.now().toString().slice(-4)}`,
        description: 'Echocardiogram Technician',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdPositionId = res.body.data.id;
  });

  it('3. HOD can create a department employee with locked EMPLOYEE role and temporary credentials', async () => {
    const res = await request(app)
      .post('/api/v1/department-management/employees')
      .set('Authorization', `Bearer ${cardioHodToken}`)
      .send({
        employeeId: `EMP-C-${Date.now().toString().slice(-4)}`,
        email: `cardio.emp.${Date.now()}@eoffice.org`,
        firstName: 'Sarah',
        lastName: 'Connor',
        phone: '+91 91234 56789',
        positionId: createdPositionId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe(UserRole.EMPLOYEE);
    expect(res.body.data.user.departmentId).toBe(cardioDept.id);
    expect(res.body.data.temporaryPassword).toBeDefined();
    expect(res.body.data.assignedPosition.id).toBe(createdPositionId);
    createdEmpId = res.body.data.user.id;
  });

  it('4. HOD can view position history of department employee', async () => {
    const res = await request(app)
      .get(`/api/v1/department-management/employees/${createdEmpId}/position-history`)
      .set('Authorization', `Bearer ${cardioHodToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.data.history[0].positionId).toBe(createdPositionId);
  });

  it('5. Admin can access organization-wide overview, but HOD is denied', async () => {
    // HOD attempt -> 403
    const hodRes = await request(app)
      .get('/api/v1/department-management/admin/overview')
      .set('Authorization', `Bearer ${cardioHodToken}`);
    expect(hodRes.status).toBe(403);

    // Admin attempt -> 200
    const adminRes = await request(app)
      .get('/api/v1/department-management/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(Array.isArray(adminRes.body.data)).toBe(true);
  });
});

