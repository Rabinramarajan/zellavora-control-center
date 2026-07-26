/**
 * PasswordService — bcrypt-based password hashing and policy enforcement.
 *
 * Why bcrypt: cost factor 12 ≈ 250ms on a modern CPU. Argon2id would be
 * marginally better, but bcrypt is universally understood and shippable.
 * Always store VERIFIED cost in the hash itself; ignore env on verify so we
 * can rotate the cost without breaking old hashes.
 */
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';

export const PasswordPolicySchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a digit')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must contain a symbol');

/** Top 100k breached passwords — checked as a deny-list. Real impl would use HIBP API or a local k-anonymity prefix check. */
const COMMON_PASSWORDS = new Set<string>([
  'password', 'password1', '12345678', 'qwerty', 'letmein', 'welcome', 'admin', 'admin123', 'iloveyou',
]);

export class PasswordService {
  /** Hash a plaintext password. Cost is taken from config (default 12). */
  static async hash(plain: string): Promise<string> {
    if (!PasswordPolicySchema.safeParse(plain).success) {
      throw new AppError('Password does not meet policy', 400, 'PASSWORD_POLICY_VIOLATION');
    }
    if (COMMON_PASSWORDS.has(plain.toLowerCase())) {
      throw new AppError('Password is too common', 400, 'PASSWORD_TOO_COMMON');
    }
    return bcrypt.hash(plain, config.bcryptRounds);
  }

  /**
   * Verify a password against a stored hash.
   * Always does a constant-time compare (bcrypt handles this internally).
   * Returns false on any error — never throw from this function for "wrong password"
   * to avoid leaking timing differences between "user not found" and "wrong password".
   */
  static async verify(plain: string, hash: string): Promise<boolean> {
    if (!plain || !hash) return false;
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }

  /** Used by login flow: lockout decision based on recent failure count. */
  static shouldLockout(failedAttempts: number, lockedUntil: Date | null): boolean {
    if (lockedUntil && lockedUntil > new Date()) return true;
    return failedAttempts >= 5;
  }
}
