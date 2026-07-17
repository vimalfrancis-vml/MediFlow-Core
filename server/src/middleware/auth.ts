import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { AppError } from './errorHandler';
import { UserRole } from '@prisma/client';

interface JwtPayload {
  userId: string;
  role: string;
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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
      console.warn('[WARN] JWT_SECRET env var is not set — using insecure default. Set it in production.');
    }

    const decoded = jwt.verify(
      token,
      jwtSecret || 'supersecretchangeinproduction'
    ) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isActive: true },
      include: { department: { select: { code: true } } },
    });

    if (!user) {
      return next(new AppError('User profile no longer exists or is disabled.', 401));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      departmentCode: user.department?.code ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
    };

    next();
  } catch (error) {
    return next(new AppError('Please sign in again to verify your identity.', 401));
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
