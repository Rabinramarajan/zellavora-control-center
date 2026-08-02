/**
 * RateLimitService — login-attempt tracking + lockout.
 *
 * Two layers:
 *   1. Per-IP:  10 failed attempts in 15 min → block for 15 min.
 *   2. Per-account: 5 failed attempts in 15 min → lock account for 15 min.
 *
 * We use the `login_attempts` table as the source of truth and derive the
 * counters in SQL (cheap with the indexes we added in 0004).
 */
import { supabaseAdmin } from '../../config/supabase';
import { AppError } from '../../middleware/error';

const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 10;
const ACCOUNT_LIMIT = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export class RateLimitService {
  /** Record an attempt and return the updated state. */
  static async record(input: {
    email: string;
    clientCode?: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
  }): Promise<void> {
    await supabaseAdmin.from('login_attempts').insert({
      email: input.email.toLowerCase(),
      client_code: input.clientCode ?? null,
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
      success: input.success,
      failure_reason: input.failureReason ?? null,
    });
  }

  /** Throws AppError(429) if the IP is over the per-IP cap. */
  static async assertIpAllowed(ipAddress: string): Promise<void> {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count, error } = await supabaseAdmin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('success', false)
      .gte('attempted_at', since);
    if (error) {
      throw new AppError('Failed to check IP rate limit', 500, 'RATE_LIMIT_CHECK_FAILED', {
        details: error.message,
      });
    }
    if ((count ?? 0) >= IP_LIMIT) {
      throw new AppError(
        'Too many failed attempts. Try again in 15 minutes.',
        429,
        'RATE_LIMITED_IP'
      );
    }
  }

  /** Throws AppError(423) if the account is currently locked. */
  static async assertAccountAllowed(
    email: string
  ): Promise<{ lockedUntil: Date | null; failedAttempts: number }> {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data: failures, error } = await supabaseAdmin
      .from('login_attempts')
      .select('attempted_at')
      .eq('email', email.toLowerCase())
      .eq('success', false)
      .gte('attempted_at', since)
      .order('attempted_at', { ascending: true });

    if (error) {
      throw new AppError('Failed to check account status', 500, 'LOCKOUT_CHECK_FAILED', {
        details: error.message,
      });
    }

    const failedAttempts = failures?.length ?? 0;
    if (failedAttempts >= ACCOUNT_LIMIT) {
      // Lock expires LOCKOUT_MS after the first failure in the window.
      const earliest = failures?.[0]?.attempted_at
        ? new Date(failures[0].attempted_at)
        : new Date();
      const lockedUntil = new Date(earliest.getTime() + LOCKOUT_MS);
      const retryAfterSeconds = Math.max(
        Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
        1
      );
      throw new AppError(
        'Account temporarily locked. Try again later.',
        423,
        'ACCOUNT_LOCKED',
        {
          lockedUntil: lockedUntil.toISOString(),
          retryAfterSeconds,
        }
      );
    }
    return { lockedUntil: null, failedAttempts };
  }

  /** Clear the failure history for an email on successful login. */
  static async clearForEmail(email: string): Promise<void> {
    await supabaseAdmin.from('login_attempts').delete().eq('email', email.toLowerCase());
  }
}
