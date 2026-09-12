import { prisma } from '../db';

export interface AuditLogFilter {
  action?: string;
  actorId?: string;
  requestId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  /**
   * Retrieves paginated audit logs with search and filtering.
   * Excludes sensitive data (passwords, hashes, tokens) by design.
   */
  static async getAuditLogs(filter?: AuditLogFilter) {
    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter?.action && filter.action.trim()) {
      where.action = filter.action.trim();
    }

    if (filter?.actorId && filter.actorId.trim()) {
      where.actorId = filter.actorId.trim();
    }

    if (filter?.requestId && filter.requestId.trim()) {
      where.requestId = filter.requestId.trim();
    }

    if (filter?.startDate || filter?.endDate) {
      where.timestamp = {};
      if (filter.startDate) {
        where.timestamp.gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        where.timestamp.lte = new Date(filter.endDate);
      }
    }

    if (filter?.search && filter.search.trim()) {
      const s = filter.search.trim();
      where.OR = [
        { description: { contains: s, mode: 'insensitive' } },
        { action: { contains: s, mode: 'insensitive' } },
        { request: { referenceNumber: { contains: s, mode: 'insensitive' } } },
        { request: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const [total, rawLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          request: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              type: true,
              status: true,
            },
          },
        },
      }),
    ]);

    // Enrich logs with actor details safely without passwordHash
    const actorIds = [...new Set(rawLogs.map((l) => l.actorId).filter(Boolean) as string[])];
    const actors = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        roleRef: {
          select: { displayName: true },
        },
        department: {
          select: { name: true, code: true, displayName: true },
        },
      },
    });

    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const enrichedLogs = rawLogs.map((log) => ({
      id: log.id,
      action: log.action,
      description: log.description,
      timestamp: log.timestamp,
      requestId: log.requestId,
      request: log.request,
      actor: log.actorId ? actorMap.get(log.actorId) || null : null,
    }));

    return {
      items: enrichedLogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
