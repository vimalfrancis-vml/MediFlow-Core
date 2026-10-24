import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app, { normalizeOrigin, getAllowedOrigins } from '../../src/app';

describe('CORS Security & Origin Validation', () => {
  const originalEnv = { ...process.env };
  const CONFIGURED_PRODUCTION_FRONTEND = 'https://hospital-frontend.example.com';

  beforeEach(() => {
    // Reset env to known clean production state for each test
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = CONFIGURED_PRODUCTION_FRONTEND;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. normalizeOrigin Utility', () => {
    it('normalizes valid standard HTTP and HTTPS origins', () => {
      expect(normalizeOrigin('https://hospital.org')).toBe('https://hospital.org');
      expect(normalizeOrigin('https://hospital.org/')).toBe('https://hospital.org');
      expect(normalizeOrigin('https://HOSPITAL.ORG:443/some/path?query=1')).toBe('https://hospital.org');
      expect(normalizeOrigin('http://localhost:5173/')).toBe('http://localhost:5173');
    });

    it('rejects malformed origins safely without throwing', () => {
      expect(normalizeOrigin('')).toBeNull();
      expect(normalizeOrigin('   ')).toBeNull();
      expect(normalizeOrigin('null')).toBeNull();
      expect(normalizeOrigin('not-a-valid-url')).toBeNull();
      expect(normalizeOrigin('https://')).toBeNull();
      expect(normalizeOrigin('javascript:alert(1)')).toBeNull();
      expect(normalizeOrigin('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
      expect(normalizeOrigin('file:///etc/passwd')).toBeNull();
    });
  });

  describe('2. Configured Production Frontend Origin', () => {
    it('allows GET requests from the explicitly configured frontend origin', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', CONFIGURED_PRODUCTION_FRONTEND);

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(CONFIGURED_PRODUCTION_FRONTEND);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('allows OPTIONS preflight requests from the explicitly configured frontend origin', async () => {
      const res = await request(app)
        .options('/api/v1/health')
        .set('Origin', CONFIGURED_PRODUCTION_FRONTEND)
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(CONFIGURED_PRODUCTION_FRONTEND);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('normalizes configured origins with trailing slashes in ALLOWED_ORIGINS', async () => {
      process.env.ALLOWED_ORIGINS = 'https://hospital-frontend.example.com/';
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://hospital-frontend.example.com');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://hospital-frontend.example.com');
    });
  });

  describe('3. Unrelated Domain Suffix Rejections (Vercel & Render)', () => {
    it('rejects an arbitrary or unrelated Vercel subdomain not in ALLOWED_ORIGINS', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-phishing.vercel.app');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects preflight OPTIONS requests from an unrelated Vercel subdomain', async () => {
      const res = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'https://malicious-phishing.vercel.app')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects an arbitrary or unrelated Render subdomain not in ALLOWED_ORIGINS', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://attacker-app.onrender.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects preflight OPTIONS requests from an unrelated Render subdomain', async () => {
      const res = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'https://attacker-app.onrender.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('4. Requests Without Origin Header', () => {
    it('allows API requests without an Origin header (direct API calls, curl, mobile, same-origin)', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('5. Malformed and Dangerous Origins', () => {
    const malformedOrigins = [
      'null',
      'javascript:alert(1)',
      'data:text/html,test',
      'not a url',
      'https://',
      '://invalid',
      'ftp://hospital.org',
    ];

    for (const badOrigin of malformedOrigins) {
      it(`safely rejects malformed origin: "${badOrigin}"`, async () => {
        const res = await request(app)
          .get('/api/v1/health')
          .set('Origin', badOrigin);

        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      });
    }
  });

  describe('6. Development Workflow Preservation', () => {
    it('allows standard local Vite dev origins when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOWED_ORIGINS;

      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('still rejects arbitrary external domains even in development mode', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOWED_ORIGINS;

      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://unrelated-attacker.vercel.app');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects localhost origins in production when not explicitly in ALLOWED_ORIGINS', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = CONFIGURED_PRODUCTION_FRONTEND;

      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
