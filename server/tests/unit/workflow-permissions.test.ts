import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll } from 'vitest';
import { UserRole } from '@prisma/client';

describe('Workflow API Admin Permissions Tests', () => {
  const jwtSecret = process.env.JWT_SECRET || 'supersecretchangeinproduction';
  let employeeToken: string;
  let hodToken: string;
  let purchaseOfficerToken: string;

  beforeAll(async () => {
    const employeeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, isActive: true },
    });
    const hodUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.HOD, isActive: true },
    });
    const purchaseOfficerUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.PURCHASE_OFFICER, isActive: true },
    });

    employeeToken = jwt.sign(
      { userId: employeeUser.id, role: employeeUser.role, tokenVersion: employeeUser.tokenVersion },
      jwtSecret,
      { expiresIn: '1h' }
    );
    hodToken = jwt.sign(
      { userId: hodUser.id, role: hodUser.role, tokenVersion: hodUser.tokenVersion },
      jwtSecret,
      { expiresIn: '1h' }
    );
    purchaseOfficerToken = jwt.sign(
      { userId: purchaseOfficerUser.id, role: purchaseOfficerUser.role, tokenVersion: purchaseOfficerUser.tokenVersion },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  it('should return 403 when an EMPLOYEE attempts to create a workflow template', async () => {
    const res = await request(app)
      .post('/api/v1/workflows')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: 'Unauthorized Flow',
        requestType: 'PURCHASE',
        steps: [
          { stepName: 'Step 1', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Access denied');
  });

  it('should return 403 when an HOD attempts to create a new workflow version', async () => {
    const res = await request(app)
      .post('/api/v1/workflows/dummy-tmpl-id/version')
      .set('Authorization', `Bearer ${hodToken}`)
      .send({
        name: 'HOD Flow',
        steps: [
          { stepName: 'Step 1', order: 1, approverRole: 'HOD', allowDynamicForwarding: true },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Access denied');
  });

  it('should return 403 when a PURCHASE_OFFICER attempts to archive a workflow', async () => {
    const res = await request(app)
      .delete('/api/v1/workflows/dummy-tmpl-id')
      .set('Authorization', `Bearer ${purchaseOfficerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Access denied');
  });

  it('should return 401 when an unauthenticated request attempts to create a workflow', async () => {
    const res = await request(app)
      .post('/api/v1/workflows')
      .send({
        name: 'Unauth Flow',
        requestType: 'PURCHASE',
        steps: [],
      });

    expect(res.status).toBe(401);
  });
});
