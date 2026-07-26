/**
 * EncryptionService — AES-256-GCM symmetric encryption.
 *
 * Used to encrypt the TOTP secret and any other field marked "encrypted" in
 * the schema. The key is taken from `config.encryptionKey` (32+ bytes required
 * in production). Output format: base64( iv(12) || authTag(16) || ciphertext ).
 */
import crypto from 'crypto';
import { config } from '@/config/env';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export class EncryptionService {
  private static getKey(): Buffer {
    if (!config.encryptionKey || config.encryptionKey.length < KEY_BYTES) {
      if (config.nodeEnv === 'production') {
        throw new Error('ENCRYPTION_KEY must be >= 32 bytes in production');
      }
      // Dev-only fallback: derive a deterministic key from the JWT secret.
      return crypto.createHash('sha256').update(config.jwtSecret).digest();
    }
    // Allow user to pass either raw bytes or hex-encoded.
    if (config.encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(config.encryptionKey)) {
      return Buffer.from(config.encryptionKey, 'hex');
    }
    return crypto.createHash('sha256').update(config.encryptionKey).digest();
  }

  static encrypt(plain: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  static decrypt(encoded: string): string {
    const key = this.getKey();
    const buf = Buffer.from(encoded, 'base64');
    const iv = buf.subarray(0, IV_BYTES);
    const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const ciphertext = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
