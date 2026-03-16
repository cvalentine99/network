/**
 * API Key Encryption at Rest (audit C3)
 *
 * Encrypts ExtraHop API keys before storing in the database using AES-256-GCM.
 * The encryption key is derived from JWT_SECRET via PBKDF2.
 *
 * Format: base64(iv:authTag:ciphertext)
 * - iv: 12 bytes (96-bit, standard for GCM)
 * - authTag: 16 bytes (128-bit)
 * - ciphertext: variable length
 *
 * This is NOT a substitute for proper secrets management (e.g., HashiCorp Vault),
 * but it prevents plaintext API keys in the database. The encryption key is
 * derived from JWT_SECRET, which must itself be kept secret.
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT = 'netperf-apikey-encryption-salt-v1'; // Static salt is acceptable here — key uniqueness comes from JWT_SECRET
const KEY_LENGTH = 32; // 256 bits

function getDerivedKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length === 0) {
    throw new Error('JWT_SECRET is required for API key encryption. Cannot encrypt with empty secret.');
  }
  return pbkdf2Sync(secret, SALT, 100_000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext API key for storage.
 * Returns a base64-encoded string containing iv + authTag + ciphertext.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack: iv (12) + authTag (16) + ciphertext (variable)
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return packed.toString('base64');
}

/**
 * Decrypt a stored API key.
 * Accepts the base64-encoded string from encryptApiKey().
 */
export function decryptApiKey(encoded: string): string {
  const key = getDerivedKey();
  const packed = Buffer.from(encoded, 'base64');

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted API key format: too short');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check if a string looks like an encrypted API key (base64 with minimum length).
 * Used during migration to detect already-encrypted values.
 */
export function isEncryptedApiKey(value: string): boolean {
  // Encrypted keys are base64 and at least IV_LENGTH + AUTH_TAG_LENGTH + 1 byte = 29 bytes
  // which is ~40 chars in base64. Plain ExtraHop API keys are typically hex strings.
  try {
    const buf = Buffer.from(value, 'base64');
    // Re-encode and check roundtrip (valid base64 check)
    if (buf.toString('base64') !== value) return false;
    // Must be at least iv + authTag + 1 byte
    return buf.length >= IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
