import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AppError } from './errorHandler';
import { UserRole } from '@prisma/client';
import { getJwtConfig } from '../config/jwt';

interface JwtPayload {
  userId: string;
  role: string;
}

interface CachedUser {
  id: string;
  email: string;
  role: UserRole;
  departmentId: string;
  departmentCode: string;
  firstName: string;
  lastName: string;
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
}) => {
  userSessionCache.set(user.id, {
    ...user,
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

  // 1. Verify JWT signature independently from database queries
  const { secret, algorithm } = getJwtConfig();

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(
      token,
      secret,
      { algorithms: [algorithm] }
    ) as JwtPayload;
  } catch (error: any) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Your session has expired. Please sign in again.', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid authentication token. Please sign in again.', 401));
    }
    return next(error);
  }

  // 2. Check in-memory session cache for recent user profile to deduplicate parallel queries
  const cached = userSessionCache.get(decoded.userId);
  if (cached && Date.now() - cached.cachedAt < USER_CACHE_TTL_MS) {
    req.user = {
      id: cached.id,
      email: cached.email,
      role: cached.role,
      departmentId: cached.departmentId,
      departmentCode: cached.departmentCode,
      firstName: cached.firstName,
      lastName: cached.lastName,
    };
    return next();
  }

  // 3. Query database with transient retry for cloud DB cold starts
  try {
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId, isActive: true, deletedAt: null },
        include: { department: { select: { code: true } } },
      });
    } catch (dbErr: any) {
      if (dbErr?.code === 'ETIMEDOUT' || dbErr?.message?.includes('timeout') || dbErr?.message?.includes('Connection')) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        user = await prisma.user.findUnique({
          where: { id: decoded.userId, isActive: true, deletedAt: null },
          include: { department: { select: { code: true } } },
        });
      } else {
        throw dbErr;
      }
    }

    if (!user) {
      return next(new AppError('User profile no longer exists or is disabled.', 401));
    }

    const userData: CachedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      departmentCode: user.department?.code ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      cachedAt: Date.now(),
    };

    userSessionCache.set(user.id, userData);

    req.user = {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      departmentId: userData.departmentId,
      departmentCode: userData.departmentCode,
      firstName: userData.firstName,
      lastName: userData.lastName,
    };

    next();
  } catch (dbErr: any) {
    // Database errors must NOT be reported as 401 (which wipes the user's frontend session)
    return next(dbErr);
  }
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
