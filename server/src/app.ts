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

const app = express();

// Initialize Middlewares
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : [];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', requestRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/departments', departmentRouter);
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
