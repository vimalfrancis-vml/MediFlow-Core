// src/controllers/request.controller.ts
import { Request, Response, NextFunction } from 'express';
import { RequestService } from '../request/request.service';
import { createRequestSchema, editRequestSchema, commentSchema, documentSchema } from '../validators/request.validators';
import { AuthUser } from '../core/WorkflowEngine';

/**
 * Wraps an async controller function and forwards any thrown error to Express's
 * next(error) handler, ensuring the global errorHandler middleware receives it.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Helper to extract authenticated user set by requireAuth middleware */
function getAuthUser(req: Request): AuthUser {
  return (req as any).user as AuthUser;
}

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const parseResult = createRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, errors: parseResult.error.format() });
  }
  const created = await RequestService.createRequest(parseResult.data, actor);
  return res.status(201).json({ success: true, message: 'Request created successfully.', data: created });
});

export const editRequest = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const parseResult = editRequestSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parseResult.success) {
    return res.status(400).json({ success: false, errors: parseResult.error.format() });
  }
  const updated = await RequestService.editRequest(parseResult.data.id as string, parseResult.data, actor);
  return res.json({ success: true, message: 'Request updated.', data: updated });
});

export const submitRequest = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const result = await RequestService.submitRequest(req.params.id as string, actor);
  return res.json({ success: true, message: 'Request submitted for review.', data: result });
});

export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const reason = req.body.reason;
  const result = await RequestService.cancelRequest(req.params.id as string, reason, actor);
  return res.json({ success: true, message: 'Request cancelled.', data: result });
});

export const getRequestById = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const result = await RequestService.getRequestById(req.params.id as string, actor);
  return res.json({ success: true, data: result });
});

export const listRequests = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const filters = {
    search: req.query.search as string,
    status: req.query.status as string,
    type: req.query.type as string,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  };
  const results = await RequestService.listRequests(actor, filters);
  return res.json({ success: true, data: results });
});

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const analytics = await RequestService.getAnalytics(actor);
  return res.json({ success: true, data: analytics });
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const parseResult = commentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, errors: parseResult.error.format() });
  }
  await RequestService.addComment(req.params.id as string, parseResult.data.comment, actor);
  return res.json({ success: true, message: 'Comment added.' });
});

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const parseResult = documentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ success: false, errors: parseResult.error.format() });
  }
  await RequestService.uploadDocument(
    req.params.id as string,
    parseResult.data.fileName,
    parseResult.data.url,
    actor,
  );
  return res.json({ success: true, message: 'Document uploaded.' });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const comment = req.body.comment;
  const result = await RequestService.approve(req.params.id as string, comment, actor);
  return res.json({ success: true, message: 'Step approved.', data: result });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const comment = req.body.comment;
  const result = await RequestService.reject(req.params.id as string, comment, actor);
  return res.json({ success: true, message: 'Step rejected.', data: result });
});

export const returnForCorrection = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const comment = req.body.comment;
  const result = await RequestService.returnForCorrection(req.params.id as string, comment, actor);
  return res.json({ success: true, message: 'Returned for changes.', data: result });
});

export const getComments = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const comments = await RequestService.getComments(req.params.id as string, actor);
  return res.json({ success: true, data: comments });
});

export const getDocuments = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const documents = await RequestService.getDocuments(req.params.id as string, actor);
  return res.json({ success: true, data: documents });
});
