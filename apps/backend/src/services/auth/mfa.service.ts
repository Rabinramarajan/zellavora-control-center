/**
 * MfaService — TOTP (RFC 6238) and recovery codes.
 *
 * Algorithm: HMAC-SHA-1, 6 digits, 30s window. Compatible with Google
 * Authenticator, Authy, 1Password, etc.
 *
 * Storage:
 *   - users.mfa_secret_encrypted — the raw TOTP secret, encrypted at rest
 *     with the org-level encryption key (AES-256-GCM).
 *   - mfa_recovery_codes — 10 single-use codes per user, hashed with bcrypt.
 *
 * Anti-replay: each verification updates mfa_last_used_counter; tokens older
 * than the last accepted one are rejected.
 */
import crypto from 'crypto';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../config/supabase';
import { config } from '../../config/env';
import { AppError } from '../../middleware/error';
import { EncryptionService } from './encryption.service';

// otplib defaults: 30s step, 1 window either side (handles clock skew)
authenticator.options = { window: 1, step: 30 };

const TOTP_ISSUER = 'Zellavora';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10;

export class MfaService {
  /** Generate a fresh TOTP secret and provisioning URI. */
  static async startEnrollment(userId: string, email: string, orgName: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(email, `${TOTP_ISSUER}:${orgName}`, secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth, { errorCorrectionLevel: 'M' });

    return {
      secret,        // shown ONCE to the user, never again
      otpauth,       // used by authenticator apps
      qrCodeDataUrl, // for QR rendering in the UI
    };
  }

  /**
   * Confirm enrollment by verifying the first TOTP code the user submits.
   * On success, the secret is encrypted and stored, recovery codes are
   * generated and persisted (hashed), and the user is flagged mfa_enabled.
   */
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

    await supabaseAdmin
      .from('users')
      .update({
        mfa_enabled: true,
        mfa_secret_encrypted: encrypted,
        mfa_enrolled_at: new Date().toISOString(),
        mfa_last_used_counter: counter,
      })
      .eq('id', opts.userId);

    // Recovery codes
    const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.generateRecoveryCode()
    );
    const rows = await Promise.all(
      plain.map(async (code) => ({
        id: uuidv4(),
        user_id: opts.userId,
        code_hash: await bcrypt.hash(code, 10),
      }))
    );
    await supabaseAdmin.from('mfa_recovery_codes').insert(rows);

    return { recoveryCodes: plain };
  }

  /** Verify a TOTP code during login. */
  static async verifyTotp(userId: string, code: string): Promise<{ valid: boolean }> {
    const { data: user } = await supabaseAdmin
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
    // Reject replays: code at counter <= last used is rejected.
    const counter = this.counterFromCode(code, secret);
    if (counter <= (user.mfa_last_used_counter ?? 0)) {
      return { valid: false };
    }
    await supabaseAdmin
      .from('users')
      .update({ mfa_last_used_counter: counter, mfa_last_used_at: new Date().toISOString() })
      .eq('id', userId);
    return { valid: true };
  }

  /**
   * Verify a recovery code. Marks the code used on success. Returns true on hit.
   * Format: 5-char groups separated by '-' (e.g. "ABC12-DEF34").
   */
  static async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.replace(/[-\s]/g, '').toUpperCase();
    const { data: codes } = await supabaseAdmin
      .from('mfa_recovery_codes')
      .select('id, code_hash')
      .eq('user_id', userId)
      .is('used_at', null);

    for (const row of codes ?? []) {
      if (await bcrypt.compare(normalized, row.code_hash)) {
        await supabaseAdmin
          .from('mfa_recovery_codes')
          .update({ used_at: new Date().toISOString() })
          .eq('id', row.id);
        return true;
      }
    }
    return false;
  }

  /** Disable MFA for a user. Requires password re-verification at the API layer. */
  static async disable(userId: string): Promise<void> {
    await supabaseAdmin
      .from('users')
      .update({
        mfa_enabled: false,
        mfa_secret_encrypted: null,
        mfa_enrolled_at: null,
        mfa_last_used_at: null,
        mfa_last_used_counter: null,
      })
      .eq('id', userId);
    await supabaseAdmin.from('mfa_recovery_codes').delete().eq('user_id', userId);
  }

  /** Re-generate recovery codes (old codes are invalidated). */
  static async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    await supabaseAdmin.from('mfa_recovery_codes').delete().eq('user_id', userId);
    const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.generateRecoveryCode()
    );
    const rows = await Promise.all(
      plain.map(async (code) => ({
        id: uuidv4(),
        user_id: userId,
        code_hash: await bcrypt.hash(code, 10),
      }))
    );
    await supabaseAdmin.from('mfa_recovery_codes').insert(rows);
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
    // 10 chars: A-Z + 2-9 (no easily-confused chars). Grouped: "ABC23-DEFGH"
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const raw = Array.from(
      { length: RECOVERY_CODE_LENGTH },
      () => alphabet[crypto.randomInt(0, alphabet.length)]
    ).join('');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }
}
