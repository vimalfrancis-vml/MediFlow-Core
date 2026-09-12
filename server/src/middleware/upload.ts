import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { AppError } from './errorHandler';

/**
 * Resolve and ensure the upload directory exists.
 * Storage path is configurable through the UPLOAD_DIR environment variable
 * for production deployment on client's self-hosted server.
 */
export const getUploadDir = (): string => {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'attachments');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Allowed file extensions
export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'csv',
]);

// Dangerous executable file extensions
export const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'pl', 'cgi', 'vbs', 'jar', 'msi',
  'ps1', 'js', 'html', 'htm', 'py', 'dll', 'com', 'scr', 'pif', 'vbe',
  'wsf', 'wsh', 'apk', 'bin', 'deb', 'rpm'
]);

// Extension to allowed MIME types mapping
export const EXTENSION_MIME_MAP: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg', 'image/pjpeg'],
  jpeg: ['image/jpeg', 'image/pjpeg'],
  doc: ['application/msword', 'application/octet-stream', 'application/x-msword'],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream',
  ],
  xls: ['application/vnd.ms-excel', 'application/octet-stream', 'application/x-msexcel'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/octet-stream',
  ],
  txt: ['text/plain'],
  csv: ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv'],
};

// Multer storage engine saving safely with UUID filenames
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const dest = getUploadDir();
      cb(null, dest);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase().replace(/^\./, '');
    const cleanExt = rawExt && ALLOWED_EXTENSIONS.has(rawExt) ? `.${rawExt}` : '';
    const safeStoredName = `${crypto.randomUUID()}${cleanExt}`;
    cb(null, safeStoredName);
  },
});

// File filter validating extension & MIME on incoming upload
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const originalName = file.originalname || '';
  
  // 1. Sanitize filename check
  if (/[\\/\0]|(\.\.)/.test(originalName)) {
    return cb(new AppError('Filename contains illegal directory traversal characters.', 400));
  }

  // 2. Extract and check extension
  const ext = path.extname(originalName).toLowerCase().replace(/^\./, '');
  if (!ext || DANGEROUS_EXTENSIONS.has(ext)) {
    return cb(new AppError(`Executable or unsupported file extension (.${ext}) is prohibited.`, 400));
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new AppError(`File extension .${ext} is not supported. Allowed formats: PDF, PNG, JPG, DOC, DOCX, XLS, XLSX, TXT, CSV.`, 400));
  }

  // 3. MIME validation
  const allowedMimes = EXTENSION_MIME_MAP[ext] || [];
  const clientMime = (file.mimetype || '').toLowerCase();
  
  if (clientMime && !allowedMimes.includes(clientMime) && clientMime !== 'application/octet-stream') {
    return cb(new AppError(`MIME type mismatch (${file.mimetype}) for extension .${ext}.`, 400));
  }

  cb(null, true);
};

export const uploadAttachmentMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
});
