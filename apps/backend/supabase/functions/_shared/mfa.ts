import { authenticator } from 'npm:otplib@12.0.1';
import qrcode from 'npm:qrcode@1.5.4';
import bcrypt from 'npm:bcryptjs@2.4.3';
import crypto from 'node:crypto';
import { getSupabaseAdmin } from './db.ts';
import { AppError } from './errors.ts';
import { EncryptionService } from './encryption.ts';

// otplib defaults: 30s step, 1 window either side (handles clock skew)
authenticator.options = { window: 1, step: 30 };

const TOTP_ISSUER = 'Zellavora';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;

export class MfaService {
  static async startEnrollment(userId: string, email: string, orgName: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, `${TOTP_ISSUER}:${orgName}`, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'M' });

    return {
      secret,
      otpauth,
      qrCodeDataUrl,
    };
  }

  static async confirmEnrollment(opts: {
    userId: string;
    secret: string;
    code: string;
  }): Promise<{ recoveryCodes: string[] }> {
    if (!authenticator.check(opts.code, opts.secret)) {
      throw new AppError('Invalid verification code', 400, 'MFA_INVALID_CODE');
    }
    const encrypted = EncryptionService.encrypt(opts.secret);
    const counter = this.counterFromCode(opts.code, opts.secret);

    const admin = getSupabaseAdmin();
    await admin
      .from('users')
      .update({
        mfa_enabled: true,
        mfa_secret_encrypted: encrypted,
        mfa_enrolled_at: new Date().toISOString(),
        mfa_last_used_counter: counter,
      })
      .eq('id', opts.userId);

    const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.generateRecoveryCode()
    );
    const rows = await Promise.all(
      plain.map(async (code) => ({
        id: crypto.randomUUID(),
        user_id: opts.userId,
        code_hash: await bcrypt.hash(code, 10),
      }))
    );
    await admin.from('mfa_recovery_codes').insert(rows);

    return { recoveryCodes: plain };
  }

  static async verifyTotp(userId: string, code: string): Promise<{ valid: boolean }> {
    const admin = getSupabaseAdmin();
    const { data: user } = await admin
      .from('users')
      .select('mfa_secret_encrypted, mfa_last_used_counter')
      .eq('id', userId)
      .single();

    if (!user?.mfa_secret_encrypted) {
      return { valid: false };
    }
    const secret = EncryptionService.decrypt(user.mfa_secret_encrypted);
    if (!authenticator.check(code, secret)) {
      return { valid: false };
    }
    const counter = this.counterFromCode(code, secret);
    if (counter <= (user.mfa_last_used_counter ?? 0)) {
      return { valid: false };
    }
    await admin
      .from('users')
      .update({ mfa_last_used_counter: counter, mfa_last_used_at: new Date().toISOString() })
      .eq('id', userId);
    return { valid: true };
  }

  static async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.replace(/[-\s]/g, '').toUpperCase();
    const admin = getSupabaseAdmin();
    const { data: codes } = await admin
      .from('mfa_recovery_codes')
      .select('id, code_hash')
      .eq('user_id', userId)
      .is('used_at', null);

    for (const row of codes ?? []) {
      if (await bcrypt.compare(normalized, row.code_hash)) {
        await admin
          .from('mfa_recovery_codes')
          .update({ used_at: new Date().toISOString() })
          .eq('id', row.id);
        return true;
      }
    }
    return false;
  }

  static async disable(userId: string): Promise<void> {
    const admin = getSupabaseAdmin();
    await admin
      .from('users')
      .update({
        mfa_enabled: false,
        mfa_secret_encrypted: null,
        mfa_enrolled_at: null,
        mfa_last_used_at: null,
        mfa_last_used_counter: null,
      })
      .eq('id', userId);
    await admin.from('mfa_recovery_codes').delete().eq('user_id', userId);
  }

  static async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const admin = getSupabaseAdmin();
    await admin.from('mfa_recovery_codes').delete().eq('user_id', userId);
    const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.generateRecoveryCode()
    );
    const rows = await Promise.all(
      plain.map(async (code) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        code_hash: await bcrypt.hash(code, 10),
      }))
    );
    await admin.from('mfa_recovery_codes').insert(rows);
    return plain;
  }

  private static counterFromCode(code: string, secret: string): number {
    const delta = authenticator.checkDelta(code, secret);
    const step = authenticator.options.step || 30;
    const now = Math.floor(Date.now() / 1000 / step);
    if (typeof delta === 'number') {
      return now + delta;
    }
    return now;
  }

  private static generateRecoveryCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const raw = Array.from(
      { length: RECOVERY_CODE_LENGTH },
      () => alphabet[crypto.randomInt(0, alphabet.length)]
    ).join('');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }
}
