/**
 * PII masking utilities — display-only helpers.
 * NEVER store masked values. Always mask on the server/component boundary.
 */

export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return '***-**-****';
  return `***-**-${digits.slice(-4)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(***) ***-${digits.slice(-4)}`;
  if (digits.length === 11) return `+* (***) ***-${digits.slice(-4)}`;
  return '***-****';
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***.***';
  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}

export function maskCreditScore(score: number, hasFullAccess: boolean = false): string {
  if (hasFullAccess) return score.toString();
  if (score >= 760) return 'Excellent (760+)';
  if (score >= 720) return 'Very Good (720–759)';
  if (score >= 680) return 'Good (680–719)';
  if (score >= 620) return 'Fair (620–679)';
  return 'Poor (<620)';
}

export function maskIncome(amount: number): string {
  return '$***,***';
}

export function maskDOB(dob: string): string {
  const year = dob.slice(0, 4);
  return `${year}-**-**`;
}

/**
 * Returns whether a role has full PII access.
 */
export function hasPIIAccess(role: string): boolean {
  return role === 'admin';
}

/**
 * Mask an object's PII fields for safe logging or display.
 * Pass the object through this before sending to Sentry, logging, or rendering in non-admin views.
 */
export function maskObjectPII<T extends Record<string, unknown>>(obj: T): T {
  const PII_FIELDS = new Set([
    'ssn', 'ssn_encrypted', 'ssn_iv',
    'date_of_birth',
    'income', 'income_encrypted', 'income_iv',
    'credit_score',
    'phone',
    'email',
    'password', 'password_hash',
  ]);

  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (PII_FIELDS.has(key)) {
      (result as Record<string, unknown>)[key] = '[REDACTED]';
    }
  }
  return result;
}
