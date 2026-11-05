import 'dotenv/config';

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  algorithm: 'HS256';
}

/**
 * Known insecure placeholder secrets that must never be used in production.
 */
const INSECURE_PLACEHOLDERS = new Set([
  'supersecretchangeinproduction',
  'changeinproduction',
  'secret',
  'changeme',
  'your-secret-key',
  'your-secure-random-secret-key-at-least-32-chars-long',
  'defaultsecret',
  'jwtsecret',
]);

/**
 * Validates the JWT configuration against MediFlow security policies.
 *
 * Rules:
 * 1. JWT_SECRET must be present and non-empty.
 * 2. JWT_SECRET must be at least 32 characters long to ensure adequate cryptographic
 *    entropy for HS256 (RFC 7518 §3.2 requirement).
 * 3. In production, known insecure or default placeholder values are strictly rejected.
 *
 * Fails safely by throwing an informative Error without exposing or leaking secret values.
 */
export function validateJwtConfig(env: NodeJS.ProcessEnv = process.env): JwtConfig {
  const rawSecret = env.JWT_SECRET;

  if (!rawSecret || rawSecret.trim().length === 0) {
    throw new Error(
      '[FATAL] JWT_SECRET environment variable is missing or empty. MediFlow requires a secure JWT_SECRET to start.'
    );
  }

  const secret = rawSecret.trim();

  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && INSECURE_PLACEHOLDERS.has(secret.toLowerCase())) {
    throw new Error(
      '[FATAL] Insecure JWT_SECRET placeholder detected in production environment. A strong, randomly generated production secret key is required.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      '[FATAL] JWT_SECRET is invalid: minimum length is 32 characters to ensure HMAC-SHA256 cryptographic security.'
    );
  }

  const expiresIn = env.JWT_EXPIRES_IN?.trim() || '1d';

  return {
    secret,
    expiresIn,
    algorithm: 'HS256',
  };
}

/**
 * Retrieves the validated JWT configuration.
 * Always resolves against current process.env and throws if invalid.
 */
export function getJwtConfig(): JwtConfig {
  return validateJwtConfig(process.env);
}

/**
 * Retrieves the validated JWT secret string.
 */
export function getJwtSecret(): string {
  return getJwtConfig().secret;
}
