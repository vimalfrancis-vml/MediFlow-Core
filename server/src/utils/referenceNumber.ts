import crypto from 'crypto';

/**
 * Generates a collision-resistant, human-readable reference number for requests.
 * Format: REQ-<timestamp>-<6-char-hex-random>
 * Example: REQ-1793890123456-4A7F9C
 *
 * This combines chronological ordering with cryptographically secure randomness,
 * avoiding collisions during rapid or concurrent request creations without exposing
 * sensitive information.
 */
export function generateReferenceNumber(): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REQ-${timestamp}-${randomSuffix}`;
}

/**
 * Checks if a caught error is a Prisma unique constraint violation (P2002)
 * specifically targeting the referenceNumber field.
 */
export function isReferenceUniqueConstraintError(error: any): boolean {
  if (error?.code !== 'P2002') {
    return false;
  }
  const target = error?.meta?.target;
  if (!target) {
    // Target undefined; could be a unique constraint violation on referenceNumber
    return true;
  }
  if (typeof target === 'string') {
    return target.includes('referenceNumber') || target.includes('Request_referenceNumber_key');
  }
  if (Array.isArray(target)) {
    return target.some(
      (t: string) => typeof t === 'string' && (t.includes('referenceNumber') || t.includes('Request_referenceNumber_key'))
    );
  }
  return true;
}

