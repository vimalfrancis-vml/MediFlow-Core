import { Request, Response, NextFunction } from 'express';
import { TerminologyService } from '../services/terminology.service';

export async function getTerminologies(req: Request, res: Response, next: NextFunction) {
  try {
    const category = req.query.category as string | undefined;
    const terms = await TerminologyService.getTerminologies(category);
    return res.json({ success: true, data: terms });
  } catch (err) {
    next(err);
  }
}

export async function getTerminologyByKey(req: Request, res: Response, next: NextFunction) {
  try {
    const term = await TerminologyService.getTerminologyByKey(req.params.key as string);
    return res.json({ success: true, data: term });
  } catch (err) {
    next(err);
  }
}

export async function updateTerminology(req: Request, res: Response, next: NextFunction) {
  try {
    const term = await TerminologyService.updateTerminology(req.params.key as string, req.body);
    return res.json({ success: true, message: 'Terminology label updated successfully', data: term });
  } catch (err) {
    next(err);
  }
}
