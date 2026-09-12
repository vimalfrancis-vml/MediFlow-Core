import { Request, Response, NextFunction } from 'express';
import { WorkflowService } from '../services/workflow.service';
import { RequestType } from '@prisma/client';

export async function getTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const filter = {
      requestType: req.query.requestType as RequestType | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };
    const templates = await WorkflowService.getTemplates(filter);
    return res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateById(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await WorkflowService.getTemplateById(req.params.id as string);
    return res.json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await WorkflowService.createTemplate(req.body);
    return res.status(201).json({ success: true, message: 'Workflow template created successfully', data: template });
  } catch (err) {
    next(err);
  }
}

export async function createNewVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await WorkflowService.createNewVersion(req.params.id as string, req.body);
    return res.status(201).json({ success: true, message: 'New workflow version created successfully', data: template });
  } catch (err) {
    next(err);
  }
}

export async function archiveTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await WorkflowService.archiveTemplate(req.params.id as string);
    return res.json({ success: true, message: 'Workflow template archived successfully', data: template });
  } catch (err) {
    next(err);
  }
}

export async function activateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await WorkflowService.activateTemplate(req.params.id as string);
    return res.json({ success: true, message: 'Workflow template activated successfully', data: template });
  } catch (err) {
    next(err);
  }
}
