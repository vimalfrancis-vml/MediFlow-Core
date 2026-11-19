import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/db';
import { UserService } from '../../src/services/user.service';
import {
  validatePasswordStrength,
  generateSecureTemporaryPassword,
  redactSensitiveData,
} from '../../src/utils/passwordPolicy';
import { UserRole } from '@prisma/client';

describe('Password Security & User Profile Management (Phase 1)', () => {
  let adminUser: any;
  let testDept: any;
  let testEmployee: any;

  beforeAll(async () => {
    testDept = await prisma.department.findFirst({
      where: { isActive: true },
    });
    if (!testDept) {
      testDept = await prisma.department.create({
        data: {
          code: 'TEST_DEPT',
          name: 'Test Department',
        },
      });
    }

    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
    });
    if (!adminUser) {
      const hash = await bcrypt.hash('Admin@Secure123!', 10);
      adminUser = await prisma.user.create({
        data: {
          email: 'admin.test@eoffice.org',
          employeeId: 'ADM-TEST-999',
          firstName: 'System',
          lastName: 'Administrator',
          role: UserRole.ADMIN,
          departmentId: testDept.id,
          passwordHash: hash,
        },
      });
    }
  });

  describe('1. Password Policy Validation', () => {
    it('accepts strong, compliant passwords', () => {
      const result = validatePasswordStrength('K#9vL$2pQ!xZ8mN@', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@hospital.org',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects passwords shorter than 12 characters', () => {
      const result = validatePasswordStrength('Ab1!Short');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters long.');
    });

    it('rejects passwords exceeding 72 UTF-8 bytes', () => {
      const longPass = 'A1!'.padEnd(75, 'x');
      const result = validatePasswordStrength(longPass);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password cannot exceed 72 bytes.');
    });

    it('rejects passwords missing uppercase letters', () => {
      const result = validatePasswordStrength('lowercase123!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter (A-Z).');
    });

    it('rejects passwords missing lowercase letters', () => {
      const result = validatePasswordStrength('UPPERCASE123!@#');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter (a-z).');
    });

    it('rejects passwords missing numeric digits', () => {
      const result = validatePasswordStrength('LettersOnly!@#$');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one numeric digit (0-9).');
    });

    it('rejects passwords missing special characters', () => {
      const result = validatePasswordStrength('Alphanumeric1234');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character (e.g. !@#$%^&*).');
    });

    it('rejects common passwords from the blocklist', () => {
      const result = validatePasswordStrength('Password1234!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('This password is too common. Please choose a more unique password.');
    });

    it('rejects passwords containing the user first name', () => {
      const result = validatePasswordStrength('HelloRobert123!', {
        firstName: 'Robert',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain your first name.');
    });

    it('rejects passwords containing the user last name', () => {
      const result = validatePasswordStrength('SecretSmith456!', {
        lastName: 'Smith',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain your last name.');
    });

    it('rejects passwords containing user email prefix', () => {
      const result = validatePasswordStrength('AlexHospital99!', {
        email: 'alexhospital@eoffice.org',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must not contain your email username.');
    });
  });

  describe('2. Temporary Password Generator', () => {
    it('generates a 16-character complex password', () => {
      const tempPass = generateSecureTemporaryPassword();
      expect(tempPass).toHaveLength(16);
      expect(/[A-Z]/.test(tempPass)).toBe(true);
      expect(/[a-z]/.test(tempPass)).toBe(true);
      expect(/[0-9]/.test(tempPass)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(tempPass)).toBe(true);
    });

    it('generates unique passwords on successive calls', () => {
      const set = new Set<string>();
      for (let i = 0; i < 20; i++) {
        set.add(generateSecureTemporaryPassword());
      }
      expect(set.size).toBe(20);
    });
  });

  describe('3. Sensitive Data Redaction Utility', () => {
    it('redacts sensitive fields in nested objects and arrays', () => {
      const payload = {
        email: 'doctor@hospital.org',
        password: 'SuperSecretPassword123!',
        user: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          temporaryPassword: 'TempPassword123!',
        },
        tokens: [{ token: 'jwt.token.here' }],
      };

      const redacted = redactSensitiveData(payload);
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.user.currentPassword).toBe('[REDACTED]');
      expect(redacted.user.newPassword).toBe('[REDACTED]');
      expect(redacted.user.temporaryPassword).toBe('[REDACTED]');
      expect(redacted.tokens[0].token).toBe('[REDACTED]');
      expect(redacted.email).toBe('doctor@hospital.org');
    });
  });

  describe('4. User Creation with Mandatory First Login Password', () => {
    it('creates a user with mustChangePassword=true and 72-hour temporary expiry', async () => {
      const email = `doctor.new.${Date.now()}@eoffice.org`;
      const empId = `EMP-${Date.now().toString().slice(-6)}`;

      testEmployee = await UserService.createUser({
        email,
        employeeId: empId,
        firstName: 'Jane',
        lastName: 'Watson',
        role: UserRole.EMPLOYEE,
        departmentId: testDept.id,
      });

      expect(testEmployee.mustChangePassword).toBe(true);
      expect(testEmployee.temporaryPassword).toBeDefined();
      expect(testEmployee.temporaryPassword.length).toBeGreaterThanOrEqual(12);

      // Verify in DB
      const dbUser = await prisma.user.findUnique({ where: { id: testEmployee.id } });
      expect(dbUser?.mustChangePassword).toBe(true);
      expect(dbUser?.tokenVersion).toBe(0);
      expect(dbUser?.temporaryPasswordExpiresAt).toBeDefined();

      const timeDiffHours =
        (dbUser!.temporaryPasswordExpiresAt!.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(timeDiffHours).toBeGreaterThan(70);
      expect(timeDiffHours).toBeLessThanOrEqual(72.5);

      // Verify password hash matches temporary password
      const match = await bcrypt.compare(testEmployee.temporaryPassword, dbUser!.passwordHash);
      expect(match).toBe(true);
    });
  });

  describe('5. Admin Password Reset & Privileged Account Re-auth', () => {
    it('resets a standard employee password without requiring admin password', async () => {
      const resetResult = await UserService.resetUserPassword(adminUser.id, testEmployee.id);
      expect(resetResult.temporaryPassword).toBeDefined();
      expect(resetResult.expiresAt).toBeDefined();

      const updated = await prisma.user.findUnique({ where: { id: testEmployee.id } });
      expect(updated?.mustChangePassword).toBe(true);
      expect(updated?.tokenVersion).toBe(1); // tokenVersion incremented to invalidate sessions
      const match = await bcrypt.compare(resetResult.temporaryPassword, updated!.passwordHash);
      expect(match).toBe(true);
    });

    it('requires admin password when resetting a privileged account (ADMIN/HOD/DIRECTOR)', async () => {
      // Create a test HOD
      const hodEmail = `hod.${Date.now()}@eoffice.org`;
      const hod = await UserService.createUser({
        email: hodEmail,
        employeeId: `HOD-${Date.now().toString().slice(-6)}`,
        firstName: 'Alan',
        lastName: 'Turing',
        role: UserRole.HOD,
        departmentId: testDept.id,
      });

      // Attempt reset without admin password
      await expect(
        UserService.resetUserPassword(adminUser.id, hod.id)
      ).rejects.toThrow('Admin re-authentication password is required');

      // Attempt reset with invalid admin password
      await expect(
        UserService.resetUserPassword(adminUser.id, hod.id, 'WrongAdminPassword123!')
      ).rejects.toThrow();

      // Clean up test HOD
      await prisma.user.delete({ where: { id: hod.id } }).catch(() => {});
    });
  });

  describe('6. Self-Service Profile Updating Whitelist', () => {
    it('allows updating phone, notificationPreferences, and languagePreference', async () => {
      const updated = await UserService.updateUserProfile(testEmployee.id, {
        phone: '+91 98765 43210',
        languagePreference: 'en',
        notificationPreferences: { email: true, inApp: true },
      });

      expect(updated.phone).toBe('+91 98765 43210');
      expect(updated.languagePreference).toBe('en');
      expect(updated.notificationPreferences).toEqual({ email: true, inApp: true });
    });

    it('ignores or rejects updating role or sensitive fields via profile update', async () => {
      const updated = await UserService.updateUserProfile(testEmployee.id, {
        phone: '+91 99999 88888',
        role: UserRole.ADMIN, // Attempt escalation
        email: 'hacked@eoffice.org',
      } as any);

      // Verify role and email remain untouched
      expect(updated.role).toBe(UserRole.EMPLOYEE);
      expect(updated.email).toBe(testEmployee.email);
    });
  });

  afterAll(async () => {
    if (testEmployee?.id) {
      await prisma.auditLog.deleteMany({ where: { actorId: testEmployee.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testEmployee.id } }).catch(() => {});
    }
  });
});

