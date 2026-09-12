import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/audit.service';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = {
      action: req.query.action as string | undefined,
      actorId: req.query.actorId as string | undefined,
      requestId: req.query.requestId as string | undefined,
      search: req.query.search as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const result = await AuditService.getAuditLogs(filter);
    return res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
