/**
 * Data Minimization & Privacy Redaction Module
 * Enforces hospital privacy standards before any text is processed by AI models.
 */

// Patterns for Indian phone numbers, international formats, and general telephone strings
const PHONE_REGEX = /(?:\+?91[- ]?)?[6-9]\d{9}|\b(?:\+?\d{1,3}[- ]?)?\(?\d{3,5}\)?[- ]?\d{3,5}[- ]?\d{3,5}\b/g;

// Email addresses
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Hospital Patient Identifiers & Medical Record Numbers (MRN, PAT-*, PID-*, IPD-*, OPD-*)
const PATIENT_ID_REGEX = /\b(?:MRN|PAT|PID|IPD|OPD|UHID)[-:#\s]*[A-Za-z0-9]{4,15}\b/gi;

// Indian National Identifiers (Aadhaar 12-digit, PAN 10-char)
const AADHAAR_REGEX = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

// Prompt injection mitigation: neutralizes common jailbreak / override phrases in user-submitted descriptions
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
  /system\s*prompt/gi,
  /you\s+are\s+now\s+(an?\s+)?unrestricted/gi,
  /override\s+your\s+rules/gi,
  /jailbreak/gi,
  /developer\s+mode/gi,
];

/**
 * Sanitizes and redacts personal and clinical identifiers from request text.
 */
export function sanitizeRequestText(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  let sanitized = text;

  // 1. Redact direct identifiers
  sanitized = sanitized.replace(PHONE_REGEX, '[PHONE_REDACTED]');
  sanitized = sanitized.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');
  sanitized = sanitized.replace(PATIENT_ID_REGEX, '[PATIENT_ID_REDACTED]');
  sanitized = sanitized.replace(AADHAAR_REGEX, '[ID_REDACTED]');
  sanitized = sanitized.replace(PAN_REGEX, '[PAN_REDACTED]');

  // 2. Neutralize prompt injection attempts inside request descriptions
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REMOVED_SECURITY_PATTERN]');
  }

  // 3. Trim length to reasonable ceiling (prevent token exhaustion / buffer overflow)
  if (sanitized.length > 2500) {
    sanitized = sanitized.substring(0, 2500) + '... [TRUNCATED]';
  }

  return sanitized;
}

/**
 * Sanitizes leave reason text, masking sensitive clinical diagnosis or private medical details
 * to preserve employee medical privacy.
 */
export function sanitizeLeaveReason(reason: string | null | undefined): string {
  if (!reason || typeof reason !== 'string') {
    return '';
  }

  const baseSanitized = sanitizeRequestText(reason);

  // Common sensitive medical terms to redact in administrative leave descriptions
  const SENSITIVE_MEDICAL_TERMS = [
    /\b(chemotherapy|radiation|biopsy|malignant|cancer|tumor|psychiatric|depression|anxiety|miscarriage|pregnancy|abortion|surgery|icu|icu admission|dialysis)\b/gi,
  ];

  let medicalProtected = baseSanitized;
  for (const term of SENSITIVE_MEDICAL_TERMS) {
    medicalProtected = medicalProtected.replace(term, '[MEDICAL_CONFIDENTIAL]');
  }

  return medicalProtected;
}
