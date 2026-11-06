import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { validateJwtConfig, getJwtConfig, getJwtSecret } from '../../src/config/jwt';

describe('MediFlow JWT Configuration & Security Hardening', () => {
  const originalEnv = { ...process.env };
  const VALID_TEST_SECRET = 'a_secure_and_very_long_test_secret_key_exceeding_32_characters_12345';
  let activeUser: any;

  beforeAll(async () => {
    activeUser = await prisma.user.findFirst({
      where: { isActive: true, deletedAt: null },
      include: { department: { select: { code: true } } },
    });
  });

  afterEach(() => {
    // Restore environment variables after each test
    process.env = { ...originalEnv };
  });

  // =========================================================================
  // 1. JWT CONFIGURATION & VALIDATION RULES
  // =========================================================================
  describe('1. Configuration Validation (validateJwtConfig)', () => {
    it('throws fatal error when JWT_SECRET is undefined', () => {
      expect(() => validateJwtConfig({} as any)).toThrow(/JWT_SECRET environment variable is missing or empty/i);
    });

    it('throws fatal error when JWT_SECRET is an empty or whitespace string', () => {
      expect(() => validateJwtConfig({ JWT_SECRET: '   ' })).toThrow(/JWT_SECRET environment variable is missing or empty/i);
    });

    it('throws fatal error when JWT_SECRET is shorter than 32 characters', () => {
      expect(() => validateJwtConfig({ JWT_SECRET: 'short_secret_under_32_chars' })).toThrow(
        /minimum length is 32 characters/i
      );
    });

    it('throws fatal error in production when JWT_SECRET is a known placeholder', () => {
      const placeholders = [
        'supersecretchangeinproduction',
        'changeinproduction',
        'secret',
        'changeme',
        'your-secret-key',
      ];

      for (const placeholder of placeholders) {
        expect(() =>
          validateJwtConfig({
            JWT_SECRET: placeholder,
            NODE_ENV: 'production',
          })
        ).toThrow(/Insecure JWT_SECRET placeholder detected in production environment/i);
      }
    });

    it('accepts a valid secret >= 32 characters and defaults expiresIn to 1d', () => {
      const config = validateJwtConfig({
        JWT_SECRET: VALID_TEST_SECRET,
      });

      expect(config.secret).toBe(VALID_TEST_SECRET);
      expect(config.algorithm).toBe('HS256');
      expect(config.expiresIn).toBe('1d');
    });

    it('preserves custom JWT_EXPIRES_IN when specified', () => {
      const config = validateJwtConfig({
        JWT_SECRET: VALID_TEST_SECRET,
        JWT_EXPIRES_IN: '8h',
      });

      expect(config.expiresIn).toBe('8h');
    });

    it('never leaks the secret value in error messages when validation fails', () => {
      const sensitiveKey = 'tooshort';
      try {
        validateJwtConfig({ JWT_SECRET: sensitiveKey });
        expect.unreachable('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).not.toContain(sensitiveKey);
        expect(err.message).toMatch(/minimum length is 32 characters/i);
      }
    });
  });

  // =========================================================================
  // 2. TOKEN SIGNING AND VERIFICATION WITH SHARED CONFIG
  // =========================================================================
  describe('2. Token Signing and Verification Consistency', () => {
    it('successfully authorizes requests with valid token signed by configured secret', async () => {
      const currentSecret = getJwtSecret();
      const token = jwt.sign(
        { userId: activeUser.id, role: activeUser.role },
        currentSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.id).toBe(activeUser.id);
      expect(res.body.data.user.email).toBe(activeUser.email);
    });

    it('rejects tokens signed with an incorrect or rogue secret', async () => {
      const wrongSecret = 'another_unauthorized_secret_key_exceeding_32_characters_99999';
      const token = jwt.sign(
        { userId: activeUser.id, role: activeUser.role },
        wrongSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/Invalid authentication token/i);
    });

    it('rejects expired tokens with clear HTTP 401 response', async () => {
      const currentSecret = getJwtSecret();
      const expiredToken = jwt.sign(
        { userId: activeUser.id, role: activeUser.role },
        currentSecret,
        { algorithm: 'HS256', expiresIn: '-10s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/session has expired/i);
    });

    it('rejects tampered or malformed tokens', async () => {
      const currentSecret = getJwtSecret();
      const validToken = jwt.sign(
        { userId: activeUser.id, role: activeUser.role },
        currentSecret,
        { algorithm: 'HS256', expiresIn: '1h' }
      );

      // Tamper with the signature portion
      const tamperedToken = validToken.substring(0, validToken.length - 6) + 'xxxxxx';

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('fail');
      expect(res.body.message).toMatch(/Invalid authentication token/i);
    });

    it('rejects tokens signed with an unsupported algorithm or none', async () => {
      // Create token with algorithm 'none'
      const unsignedToken = jwt.sign(
        { userId: activeUser.id, role: activeUser.role },
        '',
        { algorithm: 'none' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${unsignedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Invalid authentication token/i);
    });

    it('rejects requests with missing or empty Authorization header', async () => {
      const resNoHeader = await request(app).get('/api/v1/auth/me');
      expect(resNoHeader.status).toBe(401);
      expect(resNoHeader.body.message).toMatch(/Please sign in/i);

      const resEmptyBearer = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer ');
      expect(resEmptyBearer.status).toBe(401);
      expect(resEmptyBearer.body.message).toMatch(/Please sign in/i);
    });

    it('successfully logs in, issues a token signed with getJwtSecret(), and verifies on protected routes', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: 'password123' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.status).toBe('success');
      const token = loginRes.body.data.token;
      expect(token).toBeDefined();

      // Ensure the issued token verifies against getJwtSecret()
      const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as any;
      expect(decoded.userId).toBe(activeUser.id);
      expect(decoded.role).toBe(activeUser.role);

      // Verify token grants access to /api/v1/auth/me
      const meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.id).toBe(activeUser.id);
    });
  });

  // =========================================================================
  // 3. SAFE FAILURE WHEN CONFIGURATION IS INVALID AT RUNTIME
  // =========================================================================
  describe('3. Runtime Fail-Safe Behavior', () => {
    it('fails safely without exposing secrets when JWT_SECRET is removed at runtime', async () => {
      // Temporarily remove secret
      delete process.env.JWT_SECRET;

      // When secret is missing, requireAuth must fail safely
      const dummyToken = 'dummy.jwt.token';
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${dummyToken}`);

      // Should return 500 (internal error due to missing config), not 200 or 401 pretending token is bad
      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      // Must not leak secret in response
      expect(JSON.stringify(res.body)).not.toContain('supersecretchangeinproduction');
    });

    it('fails safely during login if JWT_SECRET is missing at runtime', async () => {
      delete process.env.JWT_SECRET;

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: activeUser.email, password: 'password123' });

      // Valid credentials must fail safely with HTTP 500 when JWT_SECRET is missing, never issue an insecure token
      expect(res.status).toBe(500);
      expect(res.body.status).toBe('error');
      expect(JSON.stringify(res.body)).not.toContain('supersecretchangeinproduction');
    });
  });
});
