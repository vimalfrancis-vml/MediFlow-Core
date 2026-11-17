import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AppError } from './errorHandler';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  role: string;
  tokenVersion?: number;
}

export interface CachedUser {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentCode: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  tokenVersion: number;
  cachedAt: number;
}

// In-memory user cache to deduplicate simultaneous requests on page load and avoid pool exhaustion
const userSessionCache = new Map<string, CachedUser>();
const USER_CACHE_TTL_MS = 60000; // 60 seconds

export const setUserSessionCache = (user: {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentCode: string;
  firstName: string;
  lastName: string;
  mustChangePassword?: boolean;
  tokenVersion?: number;
}) => {
  userSessionCache.set(user.id, {
    id: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentCode: user.departmentCode,
    firstName: user.firstName,
    lastName: user.lastName,
    mustChangePassword: Boolean(user.mustChangePassword),
    tokenVersion: user.tokenVersion ?? 0,
    cachedAt: Date.now(),
  });
};

export const clearUserSessionCache = (userId?: string) => {
  if (userId) {
    userSessionCache.delete(userId);
  } else {
    userSessionCache.clear();
  }
};

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Please sign in to access this page.', 401));
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is not set in production.');
    }
    console.warn('[WARN] JWT_SECRET env var is not set — using insecure default. Set it in production.');
  }

  // 1. Verify JWT signature independently from database queries
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(
      token,
      jwtSecret || 'supersecretchangeinproduction',
      { algorithms: ['HS256'] }
    ) as JwtPayload;
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Your session has expired. Please sign in again.', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid authentication token. Please sign in again.', 401));
    }
    return next(new AppError('Please sign in again to verify your identity.', 401));
  }

  let userToAttach: {
    id: string;
    email: string;
    role: UserRole;
    departmentId: string;
    departmentCode: string;
    firstName: string;
    lastName: string;
    mustChangePassword: boolean;
    tokenVersion: number;
  };

  // 2. Check in-memory session cache
  const cached = userSessionCache.get(decoded.userId);
  if (
    cached &&
    Date.now() - cached.cachedAt < USER_CACHE_TTL_MS &&
    (decoded.tokenVersion === undefined || decoded.tokenVersion === cached.tokenVersion)
  ) {
    userToAttach = cached;
  } else {
    // 3. Query database with transient retry for cloud DB cold starts
    try {
      let dbUser;
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: decoded.userId, isActive: true, deletedAt: null },
          include: { department: { select: { code: true } } },
        });
      } catch (dbErr: any) {
        if (dbErr?.code === 'ETIMEDOUT' || dbErr?.message?.includes('timeout') || dbErr?.message?.includes('Connection')) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          dbUser = await prisma.user.findUnique({
            where: { id: decoded.userId, isActive: true, deletedAt: null },
            include: { department: { select: { code: true } } },
          });
        } else {
          throw dbErr;
        }
      }

      if (!dbUser) {
        return next(new AppError('User profile no longer exists or is disabled.', 401));
      }

      // Concurrency / Invalidation: Verify tokenVersion matches user's current tokenVersion
      if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== dbUser.tokenVersion) {
        return next(new AppError('Your session has expired or was revoked. Please sign in again.', 401));
      }

      const userData: CachedUser = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        departmentId: dbUser.departmentId,
        departmentCode: dbUser.department?.code ?? '',
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        mustChangePassword: dbUser.mustChangePassword,
        tokenVersion: dbUser.tokenVersion,
        cachedAt: Date.now(),
      };

      userSessionCache.set(dbUser.id, userData);
      userToAttach = userData;
    } catch (dbErr: any) {
      // Database errors must NOT be reported as 401 (which wipes the user's frontend session)
      return next(dbErr);
    }
  }

  req.user = {
    id: userToAttach.id,
    email: userToAttach.email,
    role: userToAttach.role,
    departmentId: userToAttach.departmentId,
    departmentCode: userToAttach.departmentCode,
    firstName: userToAttach.firstName,
    lastName: userToAttach.lastName,
    mustChangePassword: userToAttach.mustChangePassword,
    tokenVersion: userToAttach.tokenVersion,
  };

  // Mandatory First-Login Password Change Enforcement
  if (userToAttach.mustChangePassword) {
    const fullPath = (req.baseUrl + req.path).replace(/\/+$/, '') || '/';
    const method = req.method.toUpperCase();

    const isAllowed =
      (method === 'POST' && (fullPath.endsWith('/auth/change-password') || fullPath === '/change-password')) ||
      (method === 'POST' && (fullPath.endsWith('/auth/logout') || fullPath === '/logout')) ||
      (method === 'GET' && (fullPath.endsWith('/auth/me') || fullPath === '/me'));

    if (!isAllowed) {
      res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required before accessing other resources.',
      });
      return;
    }
  }

  next();
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Please sign in to access this page.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Access denied. You do not have permission to view this section.', 403)
      );
    }

    next();
  };
};
