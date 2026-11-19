import crypto from 'crypto';

// Top common passwords / patterns to forbid (all normalized lowercase)
const COMMON_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'password123456',
  'administrator',
  'administrator1',
  'admin12345678',
  'welcome123456',
  'welcome2024!',
  'welcome2025!',
  'welcome2026!',
  'changeme1234',
  'hospital12345',
  'mediflow12345',
  'qwerty123456',
  'iloveyou1234',
  'letmein12345',
  'monkey123456',
  'dragon123456',
  'sunshine1234',
  'princess1234',
  'football1234',
  'baseball1234',
  'trustno11234',
  'shadow123456',
  'master123456',
  'superman1234',
  'jordan123456',
  'harley123456',
  'chelsea12345',
  'arsenal12345',
  'liverpool123',
  'charlie12345',
  'andrew123456',
  'jessica12345',
  'default12345',
  'testing12345',
  'temporary123',
  'secret123456',
  'passcode1234',
  'e-office12345',
  'eoffice12345',
  'jubilee12345',
  'jubileemission',
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export interface UserContext {
  firstName?: string;
  lastName?: string;
  email?: string;
}

/**
 * Validates password strength according to enterprise security requirements:
 * 1. Minimum 12 characters
 * 2. Maximum 72 UTF-8 bytes (bcrypt truncation safety)
 * 3. At least 1 uppercase letter
 * 4. At least 1 lowercase letter
 * 5. At least 1 digit
 * 6. At least 1 special character
 * 7. Not in common passwords list
 * 8. Does not contain user's first name, last name, or email prefix (>= 3 chars)
 */
export function validatePasswordStrength(
  password: string,
  userContext?: UserContext
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required.'] };
  }

  // Length checks
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long.');
  }

  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > 72) {
    errors.push('Password cannot exceed 72 bytes.');
  }

  // Character variety checks
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z).');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numeric digit (0-9).');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (e.g. !@#$%^&*).');
  }

  // Common passwords check
  const lowerPassword = password.toLowerCase();
  const strippedLower = lowerPassword.replace(/[^a-z0-9]/g, '');
  if (COMMON_PASSWORDS.has(lowerPassword) || COMMON_PASSWORDS.has(strippedLower)) {
    errors.push('This password is too common. Please choose a more unique password.');
  }

  // Contextual check: name / email
  if (userContext) {
    const { firstName, lastName, email } = userContext;

    if (firstName && firstName.trim().length >= 3) {
      const cleanFirst = firstName.trim().toLowerCase();
      if (lowerPassword.includes(cleanFirst)) {
        errors.push('Password must not contain your first name.');
      }
    }

    if (lastName && lastName.trim().length >= 3) {
      const cleanLast = lastName.trim().toLowerCase();
      if (lowerPassword.includes(cleanLast)) {
        errors.push('Password must not contain your last name.');
      }
    }

    if (email && email.trim().length >= 3) {
      const emailPrefix = email.split('@')[0]?.toLowerCase().trim();
      if (emailPrefix && emailPrefix.length >= 3 && lowerPassword.includes(emailPrefix)) {
        errors.push('Password must not contain your email username.');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates a cryptographically secure temporary password:
 * - 16 characters long
 * - Contains at least 2 uppercase, 2 lowercase, 2 digits, and 2 special symbols
 * - Unambiguous characters to prevent confusion (excludes 0, O, I, l, 1)
 */
export function generateSecureTemporaryPassword(): string {
  const upperCharset = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowerCharset = 'abcdefghijkmnopqrstuvwxyz';
  const digitCharset = '23456789';
  const symbolCharset = '!@#$%^&*()-_=+[]{}';
  const allCharset = upperCharset + lowerCharset + digitCharset + symbolCharset;

  const getCryptoChar = (charset: string): string => {
    const randomIdx = crypto.randomInt(0, charset.length);
    return charset.charAt(randomIdx);
  };

  // Guaranteed characters to meet requirements
  const requiredChars = [
    getCryptoChar(upperCharset),
    getCryptoChar(upperCharset),
    getCryptoChar(lowerCharset),
    getCryptoChar(lowerCharset),
    getCryptoChar(digitCharset),
    getCryptoChar(digitCharset),
    getCryptoChar(symbolCharset),
    getCryptoChar(symbolCharset),
  ];

  // Fill remaining 8 chars from the combined charset
  const remainingChars: string[] = [];
  for (let i = 0; i < 8; i++) {
    remainingChars.push(getCryptoChar(allCharset));
  }

  // Shuffle securely using Fisher-Yates
  const passwordArray = [...requiredChars, ...remainingChars];
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const temp = passwordArray[i] || 'A';
    passwordArray[i] = passwordArray[j] || 'a';
    passwordArray[j] = temp;
  }

  return passwordArray.join('');
}

/**
 * Redaction utility for logging request bodies, errors, and traces.
 * Replaces sensitive fields with [REDACTED].
 */
export function redactSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveKeys = new Set([
    'password',
    'currentpassword',
    'newpassword',
    'confirmpassword',
    'temporarypassword',
    'adminpassword',
    'passwordhash',
    'token',
    'authorization',
  ]);

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
