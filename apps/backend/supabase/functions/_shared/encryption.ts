import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const ALGO = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export class EncryptionService {
  private static getKey(): Buffer {
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') ?? '';
    const jwtSecret = Deno.env.get('JWT_SECRET') ?? 'dev-secret-change-in-production';
    const nodeEnv = Deno.env.get('NODE_ENV') ?? 'development';

    if (!encryptionKey || encryptionKey.length < KEY_BYTES) {
      if (nodeEnv === 'production') {
        throw new Error('ENCRYPTION_KEY must be >= 32 bytes in production');
      }
      return crypto.createHash('sha256').update(jwtSecret).digest();
    }

    if (encryptionKey.length === 64 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
      return Buffer.from(encryptionKey, 'hex');
    }
    return crypto.createHash('sha256').update(encryptionKey).digest();
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
