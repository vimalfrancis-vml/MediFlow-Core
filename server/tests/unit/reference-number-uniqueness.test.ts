import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from '../../src/db';
import { RequestService } from '../../src/request/request.service';
import { AuthUser } from '../../src/core/WorkflowEngine';
import { RequestType, Priority, UserRole } from '@prisma/client';
import {
  generateReferenceNumber,
  isReferenceUniqueConstraintError,
} from '../../src/utils/referenceNumber';

describe('Collision-Resistant Request Reference Number Generation', () => {
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

  describe('Format & Randomness Unit Checks', () => {
    it('generates references with standard REQ prefix, millisecond timestamp, and 6-hex uppercase entropy', () => {
      const ref = generateReferenceNumber();
      // Format: REQ-<timestamp>-<6 HEX CHARS>
      const refRegex = /^REQ-\d{13,}-[0-9A-F]{6}$/;
      expect(ref).toMatch(refRegex);
    });

    it('generates distinct reference numbers in a synchronous tight loop without collisions', () => {
      const count = 1000;
      const set = new Set<string>();

      for (let i = 0; i < count; i++) {
        set.add(generateReferenceNumber());
      }

      expect(set.size).toBe(count);
    });
  });

  describe('Rapid Concurrent Request Creations', () => {
    it('creates multiple rapid requests concurrently without reference collisions', async () => {
      const BATCH_SIZE = 10;
      const promises = Array.from({ length: BATCH_SIZE }).map((_, index) =>
        RequestService.createRequest(
          {
            title: `Rapid Concurrent Test Item ${index + 1}`,
            type: RequestType.PURCHASE,
            priority: Priority.MEDIUM,
            details: {
              itemDescription: `Concurrent Item ${index + 1}`,
              estimatedCost: 100 + index * 10,
            },
          },
          employeeActor
        )
      );

      const createdList = await Promise.all(promises);
      for (const req of createdList) {
        createdRequestIds.push(req.id);
      }

      // 1. Verify every request succeeded and has a reference number
      expect(createdList).toHaveLength(BATCH_SIZE);

      const referenceNumbers = createdList.map((r) => r.referenceNumber);
      const uniqueReferences = new Set(referenceNumbers);

      // 2. All generated references must be unique
      expect(uniqueReferences.size).toBe(BATCH_SIZE);

      // 3. All generated references adhere to the expected format
      for (const ref of referenceNumbers) {
        expect(ref).toMatch(/^REQ-\d{13,}-[0-9A-F]{6}$/);
      }

      // 4. Verify in database
      const dbRecords = await prisma.request.findMany({
        where: { id: { in: createdList.map((r) => r.id) } },
        select: { id: true, referenceNumber: true },
      });
      expect(dbRecords).toHaveLength(BATCH_SIZE);
      const dbRefSet = new Set(dbRecords.map((r) => r.referenceNumber));
      expect(dbRefSet.size).toBe(BATCH_SIZE);
    });
  });

  describe('Collision Retry and Safe Failure Handling', () => {
    it('automatically recovers and retries when a reference number collision occurs', async () => {
      // Create an existing request
      const existing = await RequestService.createRequest(
        {
          title: 'Pre-existing Collision Target',
          type: RequestType.PURCHASE,
          priority: Priority.LOW,
          details: {
            itemDescription: 'Target Item',
            estimatedCost: 500,
          },
        },
        employeeActor
      );
      createdRequestIds.push(existing.id);

      const collidingRef = existing.referenceNumber;
      let attemptCount = 0;

      // Intercept tx.request.create to inject the colliding reference number on attempt 1
      const originalTransaction = prisma.$transaction.bind(prisma);
      const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, ...rest: any[]) => {
        return originalTransaction(async (tx: any) => {
          const originalRequestCreate = tx.request.create.bind(tx.request);
          tx.request.create = vi.fn().mockImplementation(async (args: any) => {
            attemptCount++;
            if (attemptCount === 1) {
              // Force collision on attempt 1 by using existing referenceNumber
              return originalRequestCreate({
                ...args,
                data: {
                  ...args.data,
                  referenceNumber: collidingRef,
                },
              });
            }
            // Subsequent attempts succeed naturally with newly generated unique reference
            return originalRequestCreate(args);
          });
          return callback(tx);
        }, ...rest);
      });

      try {
        const recovered = await RequestService.createRequest(
          {
            title: 'Collision Recovery Request',
            type: RequestType.PURCHASE,
            priority: Priority.MEDIUM,
            details: {
              itemDescription: 'Recovery Item',
              estimatedCost: 750,
            },
          },
          employeeActor
        );
        createdRequestIds.push(recovered.id);

        expect(attemptCount).toBeGreaterThanOrEqual(2);
        expect(recovered.referenceNumber).not.toBe(collidingRef);
        expect(recovered.referenceNumber).toMatch(/^REQ-\d{13,}-[0-9A-F]{6}$/);
      } finally {
        txSpy.mockRestore();
      }
    });

    it('fails safely with an operational AppError if all retries encounter collisions', async () => {
      let attempts = 0;

      // Intercept tx.request.create to simulate persistent P2002 collision
      const originalTransaction = prisma.$transaction.bind(prisma);
      const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, ...rest: any[]) => {
        return originalTransaction(async (tx: any) => {
          tx.request.create = vi.fn().mockImplementation(async () => {
            attempts++;
            const error: any = new Error('Unique constraint failed on the fields: (`referenceNumber`)');
            error.code = 'P2002';
            error.meta = { target: ['referenceNumber'] };
            throw error;
          });
          return callback(tx);
        }, ...rest);
      });

      try {
        await expect(
          RequestService.createRequest(
            {
              title: 'Exhausted Collision Request',
              type: RequestType.PURCHASE,
              priority: Priority.HIGH,
              details: {
                itemDescription: 'Masks',
                estimatedCost: 300,
              },
            },
            employeeActor
          )
        ).rejects.toMatchObject({
          statusCode: 500,
          message: 'Unable to generate a unique request reference. Please try again.',
          isOperational: true,
        });

        // Verify it attempted 3 times before giving up
        expect(attempts).toBe(3);
      } finally {
        txSpy.mockRestore();
      }
    });

    it('correctly identifies Prisma P2002 referenceNumber constraint errors', () => {
      expect(isReferenceUniqueConstraintError({ code: 'P2002', meta: { target: ['referenceNumber'] } })).toBe(true);
      expect(isReferenceUniqueConstraintError({ code: 'P2002', meta: { target: 'referenceNumber' } })).toBe(true);
      expect(isReferenceUniqueConstraintError({ code: 'P2002', meta: { target: ['Request_referenceNumber_key'] } })).toBe(true);
      expect(isReferenceUniqueConstraintError({ code: 'P2002' })).toBe(true);

      // Other fields or errors
      expect(isReferenceUniqueConstraintError({ code: 'P2002', meta: { target: ['email'] } })).toBe(false);
      expect(isReferenceUniqueConstraintError({ code: 'P2025' })).toBe(false);
      expect(isReferenceUniqueConstraintError(new Error('Generic failure'))).toBe(false);
    });
  });
});

