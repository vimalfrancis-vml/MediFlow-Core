import { Request, Response, NextFunction } from 'express';
import { ApprovalIntelligenceService } from '../services/approval-intelligence/approval-intelligence.service';
import { RequestType } from '@prisma/client';
import { AttentionLevel } from '../services/approval-intelligence/types';

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ApprovalIntelligenceService.getOverview();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getAttentionList(req: Request, res: Response, next: NextFunction) {
  try {
    const category = req.query.category as RequestType | undefined;
    const level = req.query.level as AttentionLevel | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const data = await ApprovalIntelligenceService.getAttentionList({ category, level, limit });
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBottlenecks(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ApprovalIntelligenceService.getBottlenecks();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getDailyBriefing(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await ApprovalIntelligenceService.getDailyBriefing();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRequestSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const requestId = req.params.id as string;
    const data = await ApprovalIntelligenceService.getRequestSummary(requestId);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function processChatQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const { query, requestId } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, message: 'A query question is required.' });
    }

    const data = await ApprovalIntelligenceService.processChatQuery(query.trim(), requestId);
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
