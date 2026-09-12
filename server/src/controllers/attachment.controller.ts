import { Request, Response, NextFunction } from 'express';
import { AttachmentService } from '../services/attachment.service';
import { AppError } from '../middleware/errorHandler';
import { AuthUser } from '../core/WorkflowEngine';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function getAuthUser(req: Request): AuthUser {
  return (req as any).user as AuthUser;
}

export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  if (!req.file) {
    throw new AppError('No attachment file uploaded.', 400);
  }
  const attachment = await AttachmentService.uploadAttachment(
    req.params.id as string,
    req.file,
    actor
  );
  return res.status(201).json({
    success: true,
    message: 'Attachment uploaded successfully.',
    data: attachment,
  });
});

export const getAttachments = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const attachments = await AttachmentService.getAttachments(req.params.id as string, actor);
  return res.json({
    success: true,
    data: attachments,
  });
});

export const getAttachmentFile = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const { attachment, absolutePath } = await AttachmentService.getAttachmentFile(
    req.params.id as string,
    req.params.attachmentId as string,
    actor
  );

  // Set safe serving security headers
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  
  const isDownload = req.query.download === 'true';
  const dispositionType = isDownload ? 'attachment' : 'inline';
  // RFC 5987 safe filename header
  res.setHeader(
    'Content-Disposition',
    `${dispositionType}; filename="${encodeURIComponent(attachment.originalName)}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
  );
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  return res.sendFile(absolutePath);
});

export const deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
  const actor = getAuthUser(req);
  const result = await AttachmentService.deleteAttachment(
    req.params.id as string,
    req.params.attachmentId as string,
    actor
  );
  return res.json(result);
});
