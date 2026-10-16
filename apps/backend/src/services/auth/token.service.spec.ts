jest.mock('../../infrastructure/prisma', () => ({
  prisma: { session: { update: jest.fn().mockResolvedValue({}) } },
}));

import jwt from 'jsonwebtoken';
import { config, isUsableSecret } from '../../config/env';
import { TokenService } from './token.service';

const mutable = config as unknown as { jwtSecret: string; refreshTokenSecret: string };
const GOOD_ACCESS = 'a-test-access-secret-that-is-at-least-32-bytes';
const GOOD_REFRESH = 'a-test-refresh-secret-that-is-at-least-32-bytes';
const original = { access: mutable.jwtSecret, refresh: mutable.refreshTokenSecret };

const issue = () =>
  TokenService.issue({
    userId: 'user-1',
    tenantId: 'tenant-1',
    role: 'member',
    email: 'a@example.com',
    sessionId: 'session-1',
  });

describe('isUsableSecret', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['short-secret', false],
    ['dev-secret-change-in-production', false],
    ['dev-refresh-secret', false],
    ['x'.repeat(31), false],
    ['x'.repeat(32), true],
  ])('%p -> %p', (secret, usable) => {
    expect(isUsableSecret(secret as string | undefined)).toBe(usable);
  });
});

describe('TokenService signing secrets', () => {
  beforeEach(() => {
    mutable.jwtSecret = GOOD_ACCESS;
    mutable.refreshTokenSecret = GOOD_REFRESH;
  });
  afterAll(() => {
    mutable.jwtSecret = original.access;
    mutable.refreshTokenSecret = original.refresh;
  });

  it('signs and verifies with well-formed secrets', async () => {
    const pair = await issue();
    await expect(TokenService.verifyAccess(pair.accessToken)).resolves.toMatchObject({
      sub: 'user-1',
      tid: 'tenant-1',
    });
    expect(TokenService.verifyRefresh(pair.refreshToken)).toMatchObject({ sid: 'session-1' });
  });

  it.each([
    ['missing', ''],
    ['too short', 'short'],
    ['a known default', 'dev-secret-change-in-production'],
  ])('refuses to sign when the access secret is %s', async (_label, secret) => {
    mutable.jwtSecret = secret;
    await expect(issue()).rejects.toMatchObject({ status: 503, code: 'AUTH_UNAVAILABLE' });
  });

  it.each([
    ['missing', ''],
    ['too short', 'short'],
    ['a known default', 'dev-refresh-secret'],
  ])('refuses to sign when the refresh secret is %s', async (_label, secret) => {
    mutable.refreshTokenSecret = secret;
    await expect(issue()).rejects.toMatchObject({ status: 503, code: 'AUTH_UNAVAILABLE' });
  });

  it('does not accept a token forged with the old default secret', async () => {
    const forged = jwt.sign(
      { sub: 'attacker', tid: 'tenant-1', sid: 's', role: 'owner', email: 'x@example.com' },
      'dev-secret-change-in-production',
      { algorithm: 'HS256', issuer: 'zellavora-auth', audience: 'zellavora-app', jwtid: 'j' }
    );
    mutable.jwtSecret = 'dev-secret-change-in-production';
    await expect(TokenService.verifyAccess(forged)).rejects.toMatchObject({
      status: 503,
      code: 'AUTH_UNAVAILABLE',
    });
  });

  it('rejects verification outright when the secret is lost after a token was issued', async () => {
    const pair = await issue();
    mutable.jwtSecret = '';
    await expect(TokenService.verifyAccess(pair.accessToken)).rejects.toMatchObject({
      status: 503,
    });
    mutable.refreshTokenSecret = '';
    expect(() => TokenService.verifyRefresh(pair.refreshToken)).toThrow(
      expect.objectContaining({ status: 503 })
    );
  });

  it('still reports a bad signature as 401 when the secrets are fine', async () => {
    const forged = jwt.sign({ sub: 'x' }, 'some-other-secret-that-is-32-bytes-long!!', {
      algorithm: 'HS256',
    });
    await expect(TokenService.verifyAccess(forged)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
  });
});
