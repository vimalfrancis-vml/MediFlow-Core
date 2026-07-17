import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        departmentId: string;
        departmentCode: string;
        firstName: string;
        lastName: string;
      };
    }
  }
}
