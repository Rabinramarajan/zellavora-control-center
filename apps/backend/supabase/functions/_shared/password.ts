import bcrypt from 'npm:bcryptjs@2.4.3';
import { z } from 'npm:zod@3.22.4';
import { AppError } from './errors.ts';

export const PasswordPolicySchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a digit')
  .refine((v) => /[^A-Za-z0-9]/.test(v), 'Password must contain a symbol');

const COMMON_PASSWORDS = new Set<string>([
  'password', 'password1', '12345678', 'qwerty', 'letmein', 'welcome', 'admin', 'admin123', 'iloveyou',
]);

export class PasswordService {
  static async hash(plain: string): Promise<string> {
    if (!PasswordPolicySchema.safeParse(plain).success) {
      throw new AppError('Password does not meet policy', 400, 'PASSWORD_POLICY_VIOLATION');
    }
    if (COMMON_PASSWORDS.has(plain.toLowerCase())) {
      throw new AppError('Password is too common', 400, 'PASSWORD_TOO_COMMON');
    }
    const bcryptRounds = parseInt(Deno.env.get('BCRYPT_ROUNDS') ?? '12', 10);
    const salt = await bcrypt.genSalt(bcryptRounds);
    return await bcrypt.hash(plain, salt);
  }

  static async verify(plain: string, hash: string): Promise<boolean> {
    if (!plain || !hash) return false;
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }

  static shouldLockout(failedAttempts: number, lockedUntil: Date | null): boolean {
    if (lockedUntil && lockedUntil > new Date()) return true;
    return failedAttempts >= 5;
  }
}
