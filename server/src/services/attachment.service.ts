import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { AuthUser } from '../core/WorkflowEngine';
import { RequestStatus, UserRole } from '@prisma/client';
import { RequestService } from '../request/request.service';
import { getUploadDir, ALLOWED_EXTENSIONS, DANGEROUS_EXTENSIONS, EXTENSION_MIME_MAP } from '../middleware/upload';

export interface AttachmentDetail {
  id: string;
  requestId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
}

/**
 * Validates file signature (magic bytes) for common file types to prevent
 * file masquerading (e.g., an executable renamed with a .pdf or .jpg extension).
 */
export const validateFileSignature = async (filePath: string, ext: string): Promise<boolean> => {
  try {
    const buffer = Buffer.alloc(16);
    const fd = await fs.promises.open(filePath, 'r');
    await fd.read(buffer, 0, 16, 0);
    await fd.close();

    // Check for dangerous executable headers regardless of extension
    // 1. DOS / PE executable header: "MZ" (0x4D 0x5A)
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
      return false;
    }
    // 2. ELF executable header: 0x7F 'E' 'L' 'F'
    if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      return false;
    }
    // 3. Shell script shebang: "#!"
    if (buffer[0] === 0x23 && buffer[1] === 0x21) {
      return false;
    }

    // Validate expected signatures for specific formats
    if (ext === 'pdf') {
      // PDF must start with '%PDF-' (0x25 0x50 0x44 0x46 0x2D)
      const pdfHeader = buffer.subarray(0, 5).toString('ascii');
      return pdfHeader.startsWith('%PDF');
    }
    if (ext === 'png') {
      // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47
      );
    }
    if (ext === 'jpg' || ext === 'jpeg') {
      // JPEG magic number: FF D8 FF
      return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    if (ext === 'docx' || ext === 'xlsx') {
      // OpenXML Office files are zip archives starting with PK\x03\x04
      return buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05);
    }

    // Plain text / CSV files or standard docs pass validation
    return true;
  } catch {
    return false;
  }
};

export class AttachmentService {
  /**
   * Save an uploaded file as an attachment to a request.
   */
  static async uploadAttachment(
    requestId: string,
    file: Express.Multer.File,
    actor: AuthUser
  ): Promise<AttachmentDetail> {
    if (!file) {
      throw new AppError('No file provided for upload.', 400);
    }

    // 1. Authorize: Ensure user has permission to view/act on the request
    const request = await RequestService.getRequestById(requestId, actor);

    // 2. Request status check: Cannot upload attachments to cancelled or rejected requests
    if (request.status === RequestStatus.CANCELLED || request.status === RequestStatus.REJECTED) {
      // Clean up uploaded temp file on error
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      }
      throw new AppError('Cannot upload documents to a cancelled or rejected request.', 400);
    }

    // 3. Filename sanitization
    const rawOriginalName = file.originalname || 'attachment';
    const cleanOriginalName = rawOriginalName.replace(/[\\/\0]|(\.\.)/g, '').trim();
    if (!cleanOriginalName) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      }
      throw new AppError('Invalid filename.', 400);
    }

    const ext = path.extname(cleanOriginalName).toLowerCase().replace(/^\./, '');
    if (!ext || DANGEROUS_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      }
      throw new AppError(`File extension .${ext} is prohibited or unsupported.`, 400);
    }

    // 4. Validate file signature on disk
    const isSignatureValid = await validateFileSignature(file.path, ext);
    if (!isSignatureValid) {
      if (file.path && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      }
      throw new AppError('File contents do not match the expected file signature or format.', 400);
    }

    // 5. Inferred MIME type
    const allowedMimes = EXTENSION_MIME_MAP[ext] || ['application/octet-stream'];
    const mimeType = allowedMimes[0] || file.mimetype || 'application/octet-stream';
    const storedFilename = path.basename(file.path);

    // 6. Atomic transaction to record Attachment and AuditLog
    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          requestId,
          originalName: cleanOriginalName,
          storagePath: storedFilename,
          mimeType,
          sizeBytes: file.size,
          uploadedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId,
          action: 'DOCUMENT_UPLOADED',
          description: `Attachment "${cleanOriginalName}" (${(file.size / 1024).toFixed(1)} KB) uploaded by ${actor.firstName} ${actor.lastName}`,
        },
      });

      return created;
    });

    return {
      id: attachment.id,
      requestId: attachment.requestId,
      originalName: attachment.originalName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
      uploadedBy: {
        id: actor.id,
        firstName: actor.firstName,
        lastName: actor.lastName,
        email: actor.email,
        role: actor.role,
      },
    };
  }

  /**
   * List all attachments for a request after verifying user authorization.
   */
  static async getAttachments(requestId: string, actor: AuthUser): Promise<AttachmentDetail[]> {
    // 1. Authorize: Ensure user has permission to view this request
    await RequestService.getRequestById(requestId, actor);

    // 2. Fetch attachments
    const attachments = await prisma.attachment.findMany({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch uploader details
    const uploaderIds = [...new Set(attachments.map((a) => a.uploadedById).filter(Boolean))];
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    const uploaderMap = Object.fromEntries(uploaders.map((u) => [u.id, u]));

    return attachments.map((a) => ({
      id: a.id,
      requestId: a.requestId,
      originalName: a.originalName,
      storagePath: a.storagePath,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt,
      uploadedBy: uploaderMap[a.uploadedById] || null,
    }));
  }

  /**
   * Retrieve file path and metadata for viewing/downloading an attachment safely.
   */
  static async getAttachmentFile(
    requestId: string,
    attachmentId: string,
    actor: AuthUser
  ): Promise<{
    attachment: AttachmentDetail;
    absolutePath: string;
  }> {
    // 1. Authorize: Ensure user has permission to access this request
    await RequestService.getRequestById(requestId, actor);

    // 2. Fetch attachment record
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, requestId },
    });

    if (!attachment) {
      throw new AppError('Attachment not found for this request.', 404);
    }

    // 3. Safe path resolution and validation against directory traversal
    const uploadDir = path.resolve(getUploadDir());
    const safeStoredFilename = path.basename(attachment.storagePath);
    const resolvedPath = path.resolve(uploadDir, safeStoredFilename);

    // Strict containment check
    if (!resolvedPath.startsWith(uploadDir) || !fs.existsSync(resolvedPath)) {
      throw new AppError('Attachment file is unavailable or missing on server.', 404);
    }

    return {
      attachment: {
        id: attachment.id,
        requestId: attachment.requestId,
        originalName: attachment.originalName,
        storagePath: attachment.storagePath,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        createdAt: attachment.createdAt,
      },
      absolutePath: resolvedPath,
    };
  }

  /**
   * Delete an attachment with strict permission checks.
   */
  static async deleteAttachment(
    requestId: string,
    attachmentId: string,
    actor: AuthUser
  ): Promise<{ success: boolean; message: string }> {
    // 1. Authorize access to parent request
    const request = await RequestService.getRequestById(requestId, actor);

    // 2. Fetch attachment
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, requestId },
    });

    if (!attachment) {
      throw new AppError('Attachment not found.', 404);
    }

    // 3. Delete permissions:
    // User can delete if:
    // - User is an ADMIN
    // - User is the uploader of the attachment AND request is not COMPLETED/REJECTED/CANCELLED
    // - User is the requester AND request is in DRAFT or RETURNED status
    const isUploader = attachment.uploadedById === actor.id;
    const isAdmin = actor.role === UserRole.ADMIN;
    const isRequesterDraft = request.requestedById === actor.id && (request.status === RequestStatus.DRAFT || request.status === RequestStatus.RETURNED);

    const isTerminalStatus = request.status === RequestStatus.APPROVED || request.status === RequestStatus.REJECTED || request.status === RequestStatus.CANCELLED;

    if (!isAdmin && !isRequesterDraft && (!isUploader || isTerminalStatus)) {
      throw new AppError('You do not have permission to delete this attachment.', 403);
    }

    // 4. Delete file from local disk if present
    const uploadDir = path.resolve(getUploadDir());
    const safeStoredFilename = path.basename(attachment.storagePath);
    const resolvedPath = path.resolve(uploadDir, safeStoredFilename);

    if (resolvedPath.startsWith(uploadDir) && fs.existsSync(resolvedPath)) {
      try {
        fs.unlinkSync(resolvedPath);
      } catch {
        // Log disk deletion error but proceed to remove record
      }
    }

    // 5. Delete DB record and record audit log
    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: { id: attachmentId },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          requestId,
          action: 'DOCUMENT_DELETED',
          description: `Attachment "${attachment.originalName}" was deleted by ${actor.firstName} ${actor.lastName}`,
        },
      });
    });

    return { success: true, message: 'Attachment deleted successfully.' };
  }
}
