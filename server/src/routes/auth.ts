import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.LOGIN_RATE_LIMIT_MAX ? parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) : 10,
  message: {
    status: 'fail',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
});

// POST /api/v1/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide both email and password.', 400));
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { department: { select: { code: true } } },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    if (!user.isActive || user.deletedAt !== null) {
      return next(new AppError('Your account has been deactivated. Please contact an administrator.', 403));
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is not set in production.');
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      jwtSecret || 'supersecretchangeinproduction',
      {
        algorithm: 'HS256',
        expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any,
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          employeeId: user.employeeId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          departmentId: user.departmentId,
          departmentCode: user.department.code,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user,
    },
  });
});

export default router;
