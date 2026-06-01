/**
 * AES-256-GCM field-level encryption for PII fields.
 *
 * Used for: SSN, date_of_birth, income, credit_score
 *
 * Key management:
 * - ENCRYPTION_KEY env var must be a 32-byte base64-encoded string
 * - Generate with: openssl rand -base64 32
 * - Key rotation: decrypt with old key, re-encrypt with new key
 *   (run a migration script — do not do this inline in API routes)
 *
 * Storage format:
 * - ciphertext: base64-encoded encrypted bytes
 * - iv: base64-encoded 12-byte initialization vector (unique per encryption)
 *
 * Never store the IV with the ciphertext in the same field —
 * keep them in separate DB columns (ssn_encrypted, ssn_iv).
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 12; // bytes (96 bits — recommended for GCM)

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. PII cannot be encrypted or decrypted.'
    );
  }
  return key;
}

async function importKey(): Promise<CryptoKey> {
  const keyBase64 = getEncryptionKey();
  const keyBytes = Buffer.from(keyBase64, 'base64');

  if (keyBytes.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (256 bits). Got ${keyBytes.length} bytes.`
    );
  }

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    false, // not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns the ciphertext and IV as base64 strings — store both.
 */
export async function encryptPII(
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded
  );

  return {
    ciphertext: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  };
}

/**
 * Decrypt an AES-256-GCM ciphertext.
 * Requires both the ciphertext and the IV used during encryption.
 */
export async function decryptPII(ciphertext: string, iv: string): Promise<string> {
  const key = await importKey();
  const ciphertextBytes = Buffer.from(ciphertext, 'base64');
  const ivBytes = Buffer.from(iv, 'base64');

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBytes },
    key,
    ciphertextBytes
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Mask an SSN for display — show only the last 4 digits.
 */
export function maskSSN(ssn: string): string {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return '***-**-****';
  return `***-**-${digits.slice(-4)}`;
}

/**
 * Mask income for display — hide the actual value.
 */
export function maskIncome(_amount: number): string {
  return '$***,***';
}

/**
 * Mask date of birth — show only the year for audit displays.
 */
export function maskDOB(dob: string): string {
  const year = dob.slice(0, 4);
  return `${year}-**-**`;
}

/**
 * Validate SSN format before encryption (9 digits, no dashes).
 */
export function validateSSN(ssn: string): boolean {
  const digits = ssn.replace(/\D/g, '');
  if (digits.length !== 9) return false;
  // Reject invalid SSNs: 000, 666, 900-999 in area, all-same digits
  const area = parseInt(digits.slice(0, 3), 10);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (digits.slice(3, 5) === '00') return false;
  if (digits.slice(5) === '0000') return false;
  return true;
}

/**
 * Normalize SSN to 9-digit string (remove dashes/spaces).
 */
export function normalizeSSN(ssn: string): string {
  return ssn.replace(/\D/g, '');
}
