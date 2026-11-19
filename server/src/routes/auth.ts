import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';
import { requireAuth, setUserSessionCache, clearUserSessionCache } from '../middleware/auth';
import { getJwtConfig } from '../config/jwt';
import { validatePasswordStrength } from '../utils/passwordPolicy';
import { logger } from '../utils/logger';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.LOGIN_RATE_LIMIT_MAX ? parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) : 10,
  message: {
    status: 'fail',
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' && req.headers['x-test-rate-limit'] !== 'true',
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `${req.user?.id || 'anon'}_${req.ip}`,
  message: {
    status: 'fail',
    message: 'Too many password change attempts. Please try again after 15 minutes.',
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

    // Check temporary password expiration
    if (user.mustChangePassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt < new Date()) {
      return next(new AppError('Your temporary password has expired. Please contact an administrator.', 401));
    }

    const { secret, expiresIn, algorithm } = getJwtConfig();

    const token = jwt.sign(
      { userId: user.id, role: user.role, tokenVersion: user.tokenVersion },
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
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
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
          mustChangePassword: user.mustChangePassword,
          phone: user.phone,
          notificationPreferences: user.notificationPreferences,
          languagePreference: user.languagePreference,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/change-password
router.post(
  '/change-password',
  requireAuth,
  changePasswordLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const userId = req.user!.id;

      if (!currentPassword) {
        return next(new AppError('Current password is required.', 400));
      }

      if (!newPassword) {
        return next(new AppError('New password is required.', 400));
      }

      if (newPassword !== confirmPassword) {
        return next(new AppError('New password and confirmation do not match.', 400));
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return next(new AppError('User not found.', 404));
      }

      // 1. Verify current password
      const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        return next(new AppError('Incorrect current password.', 400));
      }

      // 2. Reject reusing current password
      const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
      if (isSamePassword) {
        return next(new AppError('New password cannot be the same as your current password.', 400));
      }

      // 3. Validate new password strength
      const validation = validatePasswordStrength(newPassword, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          message: validation.errors[0] || 'Password does not meet complexity requirements.',
          errors: validation.errors,
        });
        return;
      }

      // 4. Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // 5. Concurrency-safe atomic update
      const updateResult = await prisma.user.updateMany({
        where: {
          id: userId,
          tokenVersion: user.tokenVersion,
        },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          temporaryPasswordExpiresAt: null,
          tokenVersion: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        res.status(409).json({
          success: false,
          message: 'Concurrent update conflict. Please try again.',
        });
        return;
      }

      const nextTokenVersion = user.tokenVersion + 1;

      // 6. Invalidate old cache and issue replacement JWT
      clearUserSessionCache(userId);

      const { secret, expiresIn, algorithm } = getJwtConfig();
      const newToken = jwt.sign(
        { userId: user.id, role: user.role, tokenVersion: nextTokenVersion },
        secret,
        {
          algorithm,
          expiresIn: expiresIn as any,
        }
      );

      // Update session cache with new values
      setUserSessionCache({
        id: user.id,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        departmentCode: req.user!.departmentCode,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: false,
        tokenVersion: nextTokenVersion,
      });

      // 7. Audit log event
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'PASSWORD_CHANGED',
          description: `User ${user.email} successfully updated their password.`,
        },
      });

      logger.info(`Password successfully changed for user ${user.id} (${user.email})`);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully.',
        data: {
          token: newToken,
          user: {
            id: user.id,
            email: user.email,
            mustChangePassword: false,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (userId) {
      clearUserSessionCache(userId);
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'USER_LOGOUT',
          description: `User ${req.user?.email} logged out.`,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        employeeId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        roleId: true,
        departmentId: true,
        isActive: true,
        mustChangePassword: true,
        phone: true,
        notificationPreferences: true,
        languagePreference: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            displayName: true,
          },
        },
        roleRef: {
          select: {
            id: true,
            code: true,
            displayName: true,
          },
        },
      },
    });

    if (!user) {
      return next(new AppError('User profile not found.', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
