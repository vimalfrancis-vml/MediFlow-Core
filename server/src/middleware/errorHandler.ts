import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  if (err.name === 'MulterError') {
    err.statusCode = 400;
    err.isOperational = true;
    if (err.code === 'LIMIT_FILE_SIZE') {
      err.message = 'File size exceeds maximum allowed limit of 10MB.';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      err.message = 'Too many files uploaded at once.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      err.message = `Unexpected form field: ${err.field || 'unknown'}.`;
    }
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  if (err.stack && process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else {
    // Production: Don't leak internals
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong on our end.',
      });
    }
  }
};
