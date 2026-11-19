import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { UserRole } from '@prisma/client';

describe('Password Flow & Security Enforcement E2E', { timeout: 30000 }, () => {
  let adminUser: any;
  let testUser: any;
  let testDept: any;
  let firstLoginToken: string;
  const initialPassword = 'TempPassword123!@#';
  const newStrongPassword = 'NewSecret$Password2026!';

  beforeAll(async () => {
    testDept = await prisma.department.findFirst({ where: { isActive: true } });
    adminUser = await prisma.user.findFirst({ where: { role: UserRole.ADMIN, isActive: true } });

    const passwordHash = await bcrypt.hash(initialPassword, 10);
    testUser = await prisma.user.create({
      data: {
        email: `flow.test.${Date.now()}@eoffice.org`,
        employeeId: `FLOW-${Date.now().toString().slice(-6)}`,
        firstName: 'Flow',
        lastName: 'Tester',
        role: UserRole.EMPLOYEE,
        departmentId: testDept.id,
        passwordHash,
        mustChangePassword: true,
        tokenVersion: 0,
      },
    });

    const jwtSecret = process.env.JWT_SECRET || 'supersecretchangeinproduction';
    firstLoginToken = jwt.sign(
      { userId: testUser.id, role: testUser.role, tokenVersion: 0 },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (testUser?.id) {
      await prisma.auditLog.deleteMany({ where: { actorId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  test('1. Protected application APIs return 403 PASSWORD_CHANGE_REQUIRED when mustChangePassword=true', async () => {
    const res = await request(app)
      .get('/api/v1/departments')
      .set('Authorization', `Bearer ${firstLoginToken}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  test('2. Allowlisted endpoints (GET /me) succeed even when mustChangePassword=true', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLoginToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(true);
  });

  test('3. Change password rejects incorrect current password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${firstLoginToken}`)
      .send({
        currentPassword: 'WrongPassword999!',
        newPassword: newStrongPassword,
        confirmPassword: newStrongPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Incorrect current password');
  });

  test('4. Change password rejects reusing current password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${firstLoginToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: initialPassword,
        confirmPassword: initialPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('cannot be the same as your current password');
  });

  test('5. Change password succeeds, clears mustChangePassword, increments tokenVersion, and issues new token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${firstLoginToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: newStrongPassword,
        confirmPassword: newStrongPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.mustChangePassword).toBe(false);

    // Verify in DB
    const dbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(dbUser?.mustChangePassword).toBe(false);
    expect(dbUser?.tokenVersion).toBe(1);

    // 6. Older token is now invalidated (tokenVersion mismatch)
    const oldTokenRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLoginToken}`);

    expect(oldTokenRes.status).toBe(401);

    // 7. New token works and has full API access with mustChangePassword cleared
    const newToken = res.body.data.token;
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.mustChangePassword).toBe(false);
  });
});
