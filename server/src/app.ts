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
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, '')) 
  : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    if (
      process.env.NODE_ENV !== 'production' || 
      allowedOrigins.includes(cleanOrigin) || 
      cleanOrigin.endsWith('.vercel.app') || 
      cleanOrigin.endsWith('.onrender.com')
    ) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: "${origin}". Cleaned origin: "${cleanOrigin}". Allowed origins: ${JSON.stringify(allowedOrigins)}`);
      callback(null, false);
    }
  },
  credentials: true
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
