/**
 * MfaService — TOTP (RFC 6238) and recovery codes.
 *
 * Algorithm: HMAC-SHA-1, 6 digits, 30s window. Compatible with Google
 * Authenticator, Authy, 1Password, etc.
 *
 * Storage (users table):
 *   - mfa_secret             — TOTP secret, AES-256-GCM encrypted at rest
 *   - mfa_last_used_counter  — last accepted time-step (replay protection)
 *   - recovery_codes         — [{ hash, usedAt }]; SHA-256 of high-entropy codes
 */
import crypto from 'crypto';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import { EncryptionService } from './encryption.service';

// otplib defaults: 30s step, 1 window either side (handles clock skew)
authenticator.options = { window: 1, step: 30 };

const TOTP_ISSUER = 'Zellavora';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface StoredRecoveryCode {
  hash: string;
  usedAt: string | null;
}

export class MfaService {
  /** Generate a fresh TOTP secret and provisioning URI. The secret is not persisted here. */
  static async startEnrollment(email: string, orgName: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, `${TOTP_ISSUER}:${orgName}`, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'M' });
    return { secret, otpauth, qrCodeDataUrl };
  }

  /**
   * Confirm enrollment by verifying the first code from the authenticator app.
   * On success the secret is stored encrypted and a fresh recovery-code set issued.
   */
  static async confirmEnrollment(userId: string, secret: string, code: string): Promise<string[]> {
    if (!authenticator.check(code, secret)) {
      throw new AppError('The verification code is invalid or expired.', 400, 'MFA_INVALID_CODE');
    }
    const { plain, stored } = this.generateRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaMethod: 'authenticator',
        mfaEnrolledAt: new Date(),
        mfaSecret: EncryptionService.encrypt(secret),
        mfaLastUsedCounter: this.counterFromCode(code, secret),
        recoveryCodes: stored as never,
      },
    });
    return plain;
  }

  /** Verify a TOTP code during login, rejecting codes at or before the last accepted step. */
  static async verifyTotp(userId: string, code: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaLastUsedCounter: true },
    });
    if (!user?.mfaSecret) return false;

    const secret = this.readSecret(user.mfaSecret);
    if (!authenticator.check(code, secret)) return false;

    const counter = this.counterFromCode(code, secret);
    if (counter <= (user.mfaLastUsedCounter ?? 0)) return false;

    // Conditional update: two concurrent submissions of one code can't both win.
    const { count } = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ mfaLastUsedCounter: null }, { mfaLastUsedCounter: { lt: counter } }],
      },
      data: { mfaLastUsedCounter: counter },
    });
    return count === 1;
  }

  /**
   * Consume one recovery code. Returns the number of unused codes remaining,
   * or null if the code did not match an unused code.
   */
  static async consumeRecoveryCode(userId: string, code: string): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { recoveryCodes: true },
    });
    const codes = this.readRecoveryCodes(user?.recoveryCodes);
    const hash = this.hashRecoveryCode(code);
    const index = codes.findIndex(
      (c) => !c.usedAt && crypto.timingSafeEqual(Buffer.from(c.hash), Buffer.from(hash))
    );
    if (index === -1) return null;

    codes[index] = { ...codes[index], usedAt: new Date().toISOString() };
    await prisma.user.update({
      where: { id: userId },
      data: { recoveryCodes: codes as never },
    });
    return codes.filter((c) => !c.usedAt).length;
  }

  static async remainingRecoveryCodes(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { recoveryCodes: true },
    });
    return this.readRecoveryCodes(user?.recoveryCodes).filter((c) => !c.usedAt).length;
  }

  static async disable(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaMethod: null,
        mfaEnrolledAt: null,
        mfaSecret: null,
        mfaLastUsedCounter: null,
        recoveryCodes: Prisma.DbNull,
      },
    });
  }

  /** Issue a new recovery-code set; the previous set stops working immediately. */
  static async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const { plain, stored } = this.generateRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { recoveryCodes: stored as never },
    });
    return plain;
  }

  /** Accepts "ABCDE-FGHJK", lower case, and stray whitespace. */
  static normalizeRecoveryCode(code: string): string {
    return code.replace(/[-\s]/g, '').toUpperCase();
  }

  private static hashRecoveryCode(code: string): string {
    return crypto.createHash('sha256').update(this.normalizeRecoveryCode(code)).digest('hex');
  }

  private static generateRecoveryCodes(): { plain: string[]; stored: StoredRecoveryCode[] } {
    const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const raw = Array.from(
        { length: RECOVERY_CODE_LENGTH },
        () => RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)]
      ).join('');
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    return {
      plain,
      stored: plain.map((code) => ({ hash: this.hashRecoveryCode(code), usedAt: null })),
    };
  }

  private static readRecoveryCodes(value: unknown): StoredRecoveryCode[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (c): c is StoredRecoveryCode =>
        typeof c === 'object' && c !== null && typeof (c as StoredRecoveryCode).hash === 'string'
    );
  }

  /** Secrets enrolled before at-rest encryption was introduced are stored as raw base32. */
  private static readSecret(stored: string): string {
    if (/^[A-Z2-7]+=*$/.test(stored)) return stored;
    return EncryptionService.decrypt(stored);
  }

  private static counterFromCode(code: string, secret: string): number {
    const step = authenticator.options.step || 30;
    const now = Math.floor(Date.now() / 1000 / step);
    const delta = authenticator.checkDelta(code, secret);
    return typeof delta === 'number' ? now + delta : now;
  }
}
