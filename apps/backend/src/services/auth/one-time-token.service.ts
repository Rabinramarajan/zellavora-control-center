/**
 * OneTimeTokenService — opaque tokens delivered by email or returned to the
 * client (reset links, invitations, verification links, 2FA challenges).
 *
 * Only the SHA-256 digest is persisted, so a database read never yields a
 * usable token. 32 random bytes make brute force and salting unnecessary.
 */
import crypto from 'crypto';

export class OneTimeTokenService {
  static generate(): { token: string; hash: string } {
    const token = crypto.randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  static hash(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
