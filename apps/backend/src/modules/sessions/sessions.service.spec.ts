jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

import { SessionsService, describeUserAgent } from './sessions.service';
import type { SessionsRepository } from './sessions.repository';

const ORG = 'org';

const makeRepo = () =>
  ({
    findLive: jest.fn(async (id: string) => ({ id, userId: 'target', ipAddress: '1.2.3.4' })),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(async () => ({ count: 3 })),
  }) as unknown as jest.Mocked<SessionsRepository>;

describe('SessionsService', () => {
  it('will not revoke the caller’s current session', async () => {
    const repo = makeRepo();
    await expect(new SessionsService(repo).revoke(ORG, 'mine', 'admin', 'mine')).rejects.toMatchObject({
      code: 'CURRENT_SESSION',
    });
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it('404s for sessions outside the organization', async () => {
    const repo = makeRepo();
    repo.findLive.mockResolvedValue(null as never);
    await expect(new SessionsService(repo).revoke(ORG, 'other', 'admin', 'mine')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('keeps the caller signed in when they revoke all of their own sessions', async () => {
    const repo = makeRepo();
    await new SessionsService(repo).revokeAllForUser(ORG, 'admin', 'admin', 'mine');
    expect(repo.revokeAllForUser).toHaveBeenCalledWith(ORG, 'admin', 'mine');
  });

  it('revokes every session when targeting another user', async () => {
    const repo = makeRepo();
    const result = await new SessionsService(repo).revokeAllForUser(ORG, 'target', 'admin', 'mine');
    expect(repo.revokeAllForUser).toHaveBeenCalledWith(ORG, 'target', undefined);
    expect(result).toEqual({ revoked: 3 });
  });
});

describe('describeUserAgent', () => {
  it('recognises common browsers and platforms', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0'
      )
    ).toEqual({ browser: 'Edge', platform: 'Windows', isMobile: false });
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
      )
    ).toEqual({ browser: 'Safari', platform: 'iOS', isMobile: true });
    expect(describeUserAgent(null)).toEqual({ browser: null, platform: null, isMobile: false });
  });
});
