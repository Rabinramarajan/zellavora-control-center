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
import { prisma } from '../../infrastructure/prisma';
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
    await prisma.loginAttempt.create({
      data: {
        email: input.email.toLowerCase(),
        clientCode: input.clientCode ?? null,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        success: input.success,
        failureReason: input.failureReason ?? null,
      },
    });
  }

  /** Throws AppError(429) if the IP is over the per-IP cap. */
  static async assertIpAllowed(ipAddress: string): Promise<void> {
    const since = new Date(Date.now() - WINDOW_MS);
    const count = await prisma.loginAttempt.count({
      where: { ipAddress: ipAddress, success: false, attemptedAt: { gte: since } },
    });
    if (count >= IP_LIMIT) {
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
    const since = new Date(Date.now() - WINDOW_MS);
    const failures = await prisma.loginAttempt.findMany({
      where: { email: email.toLowerCase(), success: false, attemptedAt: { gte: since } },
      orderBy: { attemptedAt: 'asc' },
    });

    const failedAttempts = failures?.length ?? 0;
    if (failedAttempts >= ACCOUNT_LIMIT) {
      // Lock expires LOCKOUT_MS after the first failure in the window.
      const earliest = failures?.[0]?.attemptedAt ? new Date(failures[0].attemptedAt) : new Date();
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
    await prisma.loginAttempt.deleteMany({ where: { email: email.toLowerCase() } });
  }
}
