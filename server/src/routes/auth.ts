import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { requireAuth, setUserSessionCache } from '../middleware/auth';
import { getJwtConfig } from '../config/jwt';

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
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { email: cleanEmail },
        include: { department: { select: { code: true } } },
      });
    } catch (dbErr: any) {
      if (dbErr?.code === 'ETIMEDOUT' || dbErr?.message?.includes('timeout') || dbErr?.message?.includes('Connection')) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        user = await prisma.user.findUnique({
          where: { email: cleanEmail },
          include: { department: { select: { code: true } } },
        });
      } else {
        throw dbErr;
      }
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AppError('Invalid email or password.', 401));
    }

    if (!user.isActive || user.deletedAt !== null) {
      return next(new AppError('Your account has been deactivated. Please contact an administrator.', 403));
    }

    const { secret, expiresIn, algorithm } = getJwtConfig();

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      {
        algorithm,
        expiresIn: expiresIn as any,
      }
    );

    setUserSessionCache({
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      departmentCode: user.department.code,
      firstName: user.firstName,
      lastName: user.lastName,
    });

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
