import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { errorHandler, AppError } from './middleware/errorHandler';

import { prisma } from './db';
import authRouter from './routes/auth';
import requestRouter from './routes/request.routes';
import userRouter from './routes/user.routes';
import departmentRouter from './routes/department.routes';
import notificationRouter from './routes/notification.routes';
import roleRouter from './routes/role.routes';
import terminologyRouter from './routes/terminology.routes';
import workflowRouter from './routes/workflow.routes';
import auditRouter from './routes/audit.routes';

import rateLimit from 'express-rate-limit';

const app = express();

// Trust reverse proxy headers (Render, Vercel, Nginx, Cloudflare)
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configurable Global API Rate Limiter
// Defaults to a generous threshold (1000 requests / 15 min) to avoid blocking legitimate hospital intranet users sharing NAT/proxy IPs.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.API_RATE_LIMIT_MAX ? parseInt(process.env.API_RATE_LIMIT_MAX, 10) : 1000,
  message: {
    status: 'fail',
    message: 'Too many requests from this network. Please slow down and try again after a few minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
});

// Initialize Middlewares

/**
 * Safely normalizes and validates an origin string according to RFC 6454.
 * Returns the lowercased scheme + host + port, or null if the origin is malformed or invalid.
 */
export function normalizeOrigin(origin: string): string | null {
  if (!origin || typeof origin !== 'string') return null;
  const trimmed = origin.trim();
  if (!trimmed || trimmed === 'null') return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Local development origins permitted when NODE_ENV === 'development'.
 */
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/**
 * Retrieves the set of currently allowed origins.
 * Reads ALLOWED_ORIGINS dynamically from the environment.
 */
export function getAllowedOrigins(): string[] {
  const configured = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
        .map((o) => normalizeOrigin(o) || o.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    : [];

  if (process.env.NODE_ENV === 'development') {
    return Array.from(new Set([...configured, ...DEFAULT_DEV_ORIGINS]));
  }

  return Array.from(new Set(configured));
}

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Requests without an Origin header (e.g. mobile apps, curl, same-origin, server-to-server) are allowed
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = normalizeOrigin(origin);
    if (!cleanOrigin) {
      logger.warn(`CORS blocked for malformed origin: "${origin}"`);
      return callback(null, false);
    }

    const allowed = getAllowedOrigins();
    if (allowed.includes(cleanOrigin)) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked for unauthorized origin: "${origin}". Normalized: "${cleanOrigin}". Allowed origins configured: ${allowed.length}`);
    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware (must be before routes so logs fire on incoming requests)
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.http(`${req.method} ${req.originalUrl}`);
  next();
});

// Apply API Rate Limiter to all v1 API routes
app.use('/api/v1', apiLimiter);

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', requestRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/departments', departmentRouter);
app.use('/api/v1/roles', roleRouter);
app.use('/api/v1/terminology', terminologyRouter);
app.use('/api/v1/workflows', workflowRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/notifications', notificationRouter);


// Health Check Endpoint
app.get('/api/v1/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic ping db check
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'success',
      message: 'MediFlow Core API is running and connected to Neon Database.',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    next(new AppError('Database connection failed', 500));
  }
});

// Fallback for unhandled routes
app.all('/*splat', (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);

export default app;
