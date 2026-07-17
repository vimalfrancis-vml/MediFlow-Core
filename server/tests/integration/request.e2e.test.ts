// src/tests/integration/request.e2e.test.ts
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import jwt from 'jsonwebtoken';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

// Helper to generate a JWT for a given user record
async function generateToken(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const payload = { userId: user.id, role: user.role } as any;
  return jwt.sign(payload, process.env.JWT_SECRET || 'supersecretchangeinproduction', {
    expiresIn: '1h',
  });
}

/**
 * End‑to‑end scenarios covering the full request lifecycle.
 * Uses the real server, Prisma (test DB), and JWT auth.
 */
describe('Request API E2E Scenarios', () => {
  let employeeToken: string;
  let hodToken: string;
  let purchaseToken: string;
  let directorToken: string;
  let requestId: string;

  beforeAll(async () => {
    // Fetch seeded users by role
    const employee = await prisma.user.findFirstOrThrow({ where: { role: 'EMPLOYEE' } });
    const hod = await prisma.user.findFirstOrThrow({ where: { role: 'HOD' } });
    const purchase = await prisma.user.findFirstOrThrow({ where: { role: 'PURCHASE_OFFICER' } });
    const director = await prisma.user.findFirstOrThrow({ where: { role: 'DIRECTOR' } });
    employeeToken = await generateToken(employee.id);
    hodToken = await generateToken(hod.id);
    purchaseToken = await generateToken(purchase.id);
    directorToken = await generateToken(director.id);
  });

  afterAll(async () => {
    // Clean up any created requests
    if (requestId) await prisma.request.delete({ where: { id: requestId } });
    await prisma.$disconnect();
  });

  test('Draft → Submit → Approve → Complete (low‑cost scenario)', async () => {
    // 1. Create draft request
    const createRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Stationery Order',
        type: 'PURCHASE',
        details: { estimatedCost: 2000 },
        workflowTemplateId: (await prisma.workflowTemplate.findFirst({ where: { requestType: 'PURCHASE' } }))!.id,
      })
      .expect(201);
    expect(createRes.body.success).toBe(true);
    requestId = createRes.body.data.id;

    // 2. Submit request
    await request(app)
      .post(`/api/v1/requests/${requestId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    // Verify first approver is HOD
    let reqInDb = await prisma.request.findUniqueOrThrow({ where: { id: requestId }, include: { currentStep: true } });
    expect(reqInDb.currentStep?.approverRole).toBe('HOD');

    // 3. HOD approves
    await request(app)
      .post(`/api/v1/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'OK' })
      .expect(200);

    // 4. Purchase Officer approves (final)
    await request(app)
      .post(`/api/v1/requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${purchaseToken}`)
      .send({ comment: 'Procured' })
      .expect(200);

    // Verify final status
    const finalReqDb = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(finalReqDb.status).toBe('APPROVED');
    expect(finalReqDb.currentStepId).toBeNull();
  }, 30000);

  test('Draft → Submit → Reject (by HOD)', async () => {
    // Create a new request
    const createRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Reject Test',
        type: 'PURCHASE',
        details: { estimatedCost: 1500 },
        workflowTemplateId: (await prisma.workflowTemplate.findFirst({ where: { requestType: 'PURCHASE' } }))!.id,
      })
      .expect(201);
    const localId = createRes.body.data.id;

    // Submit
    await request(app)
      .post(`/api/v1/requests/${localId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    // HOD rejects
    await request(app)
      .post(`/api/v1/requests/${localId}/reject`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'Budget issue' })
      .expect(200);

    const after = await prisma.request.findUniqueOrThrow({ where: { id: localId } });
    expect(after.status).toBe('REJECTED');
    // Clean up
    await prisma.request.delete({ where: { id: localId } });
  }, 30000);

  test('Draft → Submit → Return → Edit → Resubmit → Approve', async () => {
    const createRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Needs Correction',
        type: 'PURCHASE',
        details: { estimatedCost: 1200 },
        workflowTemplateId: (await prisma.workflowTemplate.findFirst({ where: { requestType: 'PURCHASE' } }))!.id,
      })
      .expect(201);
    const localId = createRes.body.data.id;

    // Submit
    await request(app)
      .post(`/api/v1/requests/${localId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    // HOD returns for correction
    await request(app)
      .post(`/api/v1/requests/${localId}/return`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'Missing justification' })
      .expect(200);

    // Edit request (add justification)
    await request(app)
      .put(`/api/v1/requests/${localId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'Needs Correction', details: { estimatedCost: 1200, justification: 'Updated' } })
      .expect(200);

    // Resubmit
    await request(app)
      .post(`/api/v1/requests/${localId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    // HOD approves
    await request(app)
      .post(`/api/v1/requests/${localId}/approve`)
      .set('Authorization', `Bearer ${hodToken}`)
      .send({ comment: 'Now OK' })
      .expect(200);

    // Purchase Officer approves (final)
    await request(app)
      .post(`/api/v1/requests/${localId}/approve`)
      .set('Authorization', `Bearer ${purchaseToken}`)
      .send({ comment: 'All good' })
      .expect(200);

    const final = await prisma.request.findUniqueOrThrow({ where: { id: localId } });
    expect(final.status).toBe('APPROVED');
    // Cleanup
    await prisma.request.delete({ where: { id: localId } });
  }, 60000);

  test('Draft → Cancel', async () => {
    const createRes = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Cancel Test',
        type: 'PURCHASE',
        details: { estimatedCost: 800 },
        workflowTemplateId: (await prisma.workflowTemplate.findFirst({ where: { requestType: 'PURCHASE' } }))!.id,
      })
      .expect(201);
    const localId = createRes.body.data.id;

    // Cancel directly
    await request(app)
      .post(`/api/v1/requests/${localId}/cancel`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ reason: 'No longer needed' })
      .expect(200);

    const after = await prisma.request.findUniqueOrThrow({ where: { id: localId } });
    expect(after.status).toBe('CANCELLED');
    // Cleanup
    await prisma.request.delete({ where: { id: localId } });
  }, 30000);
});
