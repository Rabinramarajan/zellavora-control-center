/**
 * Centralized sanitization/redaction utility for audit logs.
 * Ensures passwords, tokens, API keys, credentials, cookies, and sensitive
 * personal/auth secrets are never persisted in audit storage or logs.
 */

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /cookie/i,
  /session/i,
  /key$/i,
  /private/i,
  /api[_-]?key/i,
  /mfa/i,
  /otp/i,
  /credit[_-]?card/i,
  /cvv/i,
  /ssn/i,
];

const REDACTED_VALUE = '[REDACTED]';

export class AuditSanitizer {
  /**
   * Deeply cleans and redacts any sensitive keys from objects or primitives.
   */
  static sanitize<T>(data: T): T {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => AuditSanitizer.sanitize(item)) as unknown as T;
    }

    if (data instanceof Date) {
      return data;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      if (AuditSanitizer.isSensitiveKey(key)) {
        cleaned[key] = REDACTED_VALUE;
      } else if (val && typeof val === 'object') {
        cleaned[key] = AuditSanitizer.sanitize(val);
      } else {
        cleaned[key] = val;
      }
    }

    return cleaned as T;
  }

  /**
   * Computes a safe diff between before and after objects, showing only changed fields
   * with sensitive keys redacted.
   */
  static computeChanges(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined
  ): Array<{ field: string; previousValue: unknown; newValue: unknown }> {
    if (!before && !after) return [];
    const b = AuditSanitizer.sanitize(before ?? {});
    const a = AuditSanitizer.sanitize(after ?? {});

    const allKeys = new Set([...Object.keys(b), ...Object.keys(a)]);
    const changes: Array<{ field: string; previousValue: unknown; newValue: unknown }> = [];

    for (const key of allKeys) {
      const prev = b[key];
      const next = a[key];

      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        changes.push({
          field: key,
          previousValue: prev !== undefined ? prev : null,
          newValue: next !== undefined ? next : null,
        });
      }
    }

    return changes;
  }

  /**
   * Sanitizes safe error messages to ensure internal stack traces or database connection
   * strings are not exposed.
   */
  static safeErrorMessage(err: unknown): { code?: string; message: string } {
    if (!err) return { message: 'Unknown error occurred' };

    let msg = 'Internal operational error';
    let code: string | undefined = undefined;

    if (typeof err === 'object' && err !== null) {
      const e = err as { code?: string; message?: string; name?: string };
      if (e.code && typeof e.code === 'string') {
        code = e.code;
      }
      if (e.message && typeof e.message === 'string') {
        msg = e.message;
      }
    } else if (typeof err === 'string') {
      msg = err;
    }

    // Strip sensitive patterns like database URIs, passwords, or raw stack traces
    msg = msg
      .replace(/postgres(ql)?:\/\/[^\s]+/gi, '[DATABASE_URL_REDACTED]')
      .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
      .split('\n')[0] // Take first line only, discard stack traces
      .trim();

    return { code, message: msg };
  }

  private static isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }
}
