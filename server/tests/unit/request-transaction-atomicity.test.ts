import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { AuthUser } from '../../src/core/WorkflowEngine';
import { RequestType, Priority, UserRole } from '@prisma/client';

describe('Request Transaction Atomicity (Creation & Editing)', () => {
  let employeeUser: any;
  let employeeActor: AuthUser;
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    employeeUser = await prisma.user.findFirstOrThrow({
      where: { role: UserRole.EMPLOYEE, isActive: true, deletedAt: null },
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
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (createdRequestIds.length > 0) {
      await prisma.purchaseDetail.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.auditLog.deleteMany({ where: { requestId: { in: createdRequestIds } } });
      await prisma.request.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
  });

  it('atomically creates a request and its corresponding audit entry on success', async () => {
    const created = await RequestService.createRequest(
      {
        title: 'Atomicity Test Request',
        type: RequestType.PURCHASE,
        priority: Priority.MEDIUM,
        details: {
          itemDescription: 'Pulse Oximeter Sensors',
          estimatedCost: 3500,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // 1. Verify request persisted
    const requestInDb = await prisma.request.findUnique({
      where: { id: created.id },
      include: { purchaseDetail: true },
    });
    expect(requestInDb).not.toBeNull();
    expect(requestInDb?.title).toBe('Atomicity Test Request');

    // 2. Verify audit log entry was created
    const auditLogs = await prisma.auditLog.findMany({
      where: { requestId: created.id },
    });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('CREATED');
    expect(auditLogs[0].actorId).toBe(employeeActor.id);
    expect(auditLogs[0].description).toContain(`Request created by ${employeeActor.firstName} ${employeeActor.lastName}`);
  });

  it('rolls back request creation if audit log creation fails', async () => {
    const uniqueTitle = `Fail Audit Creation ${Date.now()}`;
    const initialCount = await prisma.request.count({
      where: { requestedById: employeeActor.id },
    });

    // Intercept $transaction to simulate auditLog.create failure inside the transaction
    const originalTransaction = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, ...rest: any[]) => {
      return originalTransaction(async (tx: any) => {
        const originalAuditCreate = tx.auditLog.create.bind(tx.auditLog);
        tx.auditLog.create = vi.fn().mockImplementation(async (args: any) => {
          if (args.data?.action === 'CREATED') {
            throw new Error('Database audit log table constraint failure');
          }
          return originalAuditCreate(args);
        });
        return callback(tx);
      }, ...rest);
    });

    try {
      await expect(
        RequestService.createRequest(
          {
            title: uniqueTitle,
            type: RequestType.PURCHASE,
            priority: Priority.HIGH,
            details: {
              itemDescription: 'Anesthesia Masks',
              estimatedCost: 1200,
            },
          },
          employeeActor
        )
      ).rejects.toThrow('Database audit log table constraint failure');

      // Verify transaction rolled back: request was NOT committed
      const uncommittedRequest = await prisma.request.findFirst({
        where: { title: uniqueTitle },
      });
      expect(uncommittedRequest).toBeNull();

      const finalCount = await prisma.request.count({
        where: { requestedById: employeeActor.id },
      });
      expect(finalCount).toBe(initialCount);

      // Verify no orphan audit logs were written
      const orphanAudit = await prisma.auditLog.findFirst({
        where: { description: { contains: uniqueTitle } },
      });
      expect(orphanAudit).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('atomically updates request and writes an audit entry on edit', async () => {
    // Create initial request
    const created = await RequestService.createRequest(
      {
        title: 'Original Title Before Edit',
        type: RequestType.PURCHASE,
        priority: Priority.LOW,
        details: {
          itemDescription: 'Bandages Box',
          estimatedCost: 400,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Edit the request
    const updated = await RequestService.editRequest(
      created.id,
      {
        title: 'Updated Title After Edit',
        priority: Priority.HIGH,
        details: {
          itemDescription: 'Bandages Box - Bulk 500pk',
          estimatedCost: 850,
        },
      },
      employeeActor
    );

    expect(updated.title).toBe('Updated Title After Edit');
    expect(updated.priority).toBe(Priority.HIGH);

    // Verify DB state
    const dbRecord = await prisma.request.findUnique({
      where: { id: created.id },
      include: { purchaseDetail: true },
    });
    expect(dbRecord?.title).toBe('Updated Title After Edit');
    expect(Number(dbRecord?.purchaseDetail?.estimatedCost)).toBe(850);

    // Verify audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { requestId: created.id },
      orderBy: { timestamp: 'asc' },
    });
    expect(auditLogs).toHaveLength(2);
    expect(auditLogs[0].action).toBe('CREATED');
    expect(auditLogs[1].action).toBe('UPDATED');
    expect(auditLogs[1].actorId).toBe(employeeActor.id);
    expect(auditLogs[1].description).toContain(`Request edited by ${employeeActor.firstName} ${employeeActor.lastName}`);
  });

  it('rolls back request edit if audit log creation fails', async () => {
    // Create initial request
    const created = await RequestService.createRequest(
      {
        title: 'Initial Title Pre-Rollback',
        type: RequestType.PURCHASE,
        priority: Priority.LOW,
        details: {
          itemDescription: 'Syringes Box',
          estimatedCost: 600,
        },
      },
      employeeActor
    );
    createdRequestIds.push(created.id);

    // Intercept $transaction to simulate auditLog.create failure on UPDATED action
    const originalTransaction = prisma.$transaction.bind(prisma);
    const spy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, ...rest: any[]) => {
      return originalTransaction(async (tx: any) => {
        const originalAuditCreate = tx.auditLog.create.bind(tx.auditLog);
        tx.auditLog.create = vi.fn().mockImplementation(async (args: any) => {
          if (args.data?.action === 'UPDATED') {
            throw new Error('Database audit log disk full');
          }
          return originalAuditCreate(args);
        });
        return callback(tx);
      }, ...rest);
    });

    try {
      await expect(
        RequestService.editRequest(
          created.id,
          {
            title: 'Should Be Rolled Back Title',
            details: {
              itemDescription: 'New Syringes',
              estimatedCost: 1200,
            },
          },
          employeeActor
        )
      ).rejects.toThrow('Database audit log disk full');

      // Verify request state rolled back: title and cost are untouched
      const dbRecord = await prisma.request.findUnique({
        where: { id: created.id },
        include: { purchaseDetail: true },
      });
      expect(dbRecord?.title).toBe('Initial Title Pre-Rollback');
      expect(Number(dbRecord?.purchaseDetail?.estimatedCost)).toBe(600);

      // Verify no UPDATED audit log exists
      const updatedAudit = await prisma.auditLog.findFirst({
        where: { requestId: created.id, action: 'UPDATED' },
      });
      expect(updatedAudit).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

