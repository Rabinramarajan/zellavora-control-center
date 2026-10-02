jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

import { SessionScope, SessionsService, describeUserAgent } from './sessions.service';
import type { SessionsRepository } from './sessions.repository';

const ORG = 'org';
const ALL: SessionScope = { kind: 'all' };
const only = (...ids: string[]): SessionScope => ({ kind: 'users', userIds: new Set(ids) });

/** manager → lead → dev → intern, plus a separate team containing `lead` and `designer`. */
const REPORTS: Record<string, string[]> = {
  manager: ['lead'],
  lead: ['dev'],
  dev: ['intern'],
};
const TEAMS: Record<string, string[]> = { lead: ['lead', 'designer'] };

const makeRepo = () =>
  ({
    findLive: jest.fn(async (id: string) => ({ id, userId: 'target', ipAddress: '1.2.3.4' })),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(async () => ({ count: 3 })),
    findUserIds: jest.fn(async () => [{ id: 'dev' }, { id: 'stranger' }]),
    list: jest.fn(async () => ({ data: [], total: 0 })),
    findUsers: jest.fn(async () => []),
    stats: jest.fn(async () => ({ activeSessions: 0, activeUsers: 0 })),
    directReports: jest.fn(async (_org: string, managers: string[]) =>
      managers.flatMap((m) => REPORTS[m] ?? []).map((id) => ({ id }))
    ),
    teammates: jest.fn(async (_org: string, userId: string) =>
      (TEAMS[userId] ?? []).map((id) => ({ id }))
    ),
  }) as unknown as jest.Mocked<SessionsRepository>;

const ids = (scope: SessionScope) => (scope.kind === 'all' ? 'all' : [...scope.userIds].sort());

describe('SessionsService scope', () => {
  it('gives the organization owner (super admin) every session', async () => {
    const repo = makeRepo();
    expect(await new SessionsService(repo).resolveScope(ORG, 'owner', true)).toEqual(ALL);
    expect(repo.directReports).not.toHaveBeenCalled();
  });

  it('gives a manager their whole reporting chain', async () => {
    const scope = await new SessionsService(makeRepo()).resolveScope(ORG, 'manager', false);
    expect(ids(scope)).toEqual(['dev', 'intern', 'lead', 'manager']);
  });

  it('gives a team lead their reports and their team members', async () => {
    const scope = await new SessionsService(makeRepo()).resolveScope(ORG, 'lead', false);
    expect(ids(scope)).toEqual(['designer', 'dev', 'intern', 'lead']);
  });

  it('survives reporting-manager cycles', async () => {
    const repo = makeRepo();
    repo.directReports.mockImplementation(((_o: string, managers: string[]) =>
      Promise.resolve(managers.map((m) => ({ id: m === 'a' ? 'b' : 'a' })))) as never);
    const scope = await new SessionsService(repo).resolveScope(ORG, 'a', false);
    expect(ids(scope)).toEqual(['a', 'b']);
  });

  it('lists only in-scope users, even when searching', async () => {
    const repo = makeRepo();
    const query = { q: 'x', page: 1, pageSize: 20 } as never;
    await new SessionsService(repo).list(ORG, query, only('dev', 'lead'));
    expect(repo.list).toHaveBeenCalledWith(ORG, query, ['dev']);
  });

  it('lists everyone for the owner', async () => {
    const repo = makeRepo();
    const query = { page: 1, pageSize: 20 } as never;
    await new SessionsService(repo).list(ORG, query, ALL);
    expect(repo.list).toHaveBeenCalledWith(ORG, query, undefined);
  });

  it('scopes stats to the viewer’s people', async () => {
    const repo = makeRepo();
    await new SessionsService(repo).stats(ORG, only('dev'));
    expect(repo.stats).toHaveBeenCalledWith(ORG, ['dev']);
  });

  it('hides out-of-scope sessions behind a 404 when revoking', async () => {
    const repo = makeRepo();
    await expect(
      new SessionsService(repo).revoke(ORG, 's1', 'lead', only('lead'), 'mine')
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it('refuses to sign out a user outside the viewer’s scope', async () => {
    const repo = makeRepo();
    await expect(
      new SessionsService(repo).revokeAllForUser(ORG, 'stranger', 'lead', only('lead'), 'mine')
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.revokeAllForUser).not.toHaveBeenCalled();
  });
});

describe('SessionsService revoke', () => {
  it('will not revoke the caller’s current session', async () => {
    const repo = makeRepo();
    await expect(
      new SessionsService(repo).revoke(ORG, 'mine', 'admin', ALL, 'mine')
    ).rejects.toMatchObject({ code: 'CURRENT_SESSION' });
    expect(repo.revoke).not.toHaveBeenCalled();
  });

  it('404s for sessions outside the organization', async () => {
    const repo = makeRepo();
    repo.findLive.mockResolvedValue(null as never);
    await expect(
      new SessionsService(repo).revoke(ORG, 'other', 'admin', ALL, 'mine')
    ).rejects.toMatchObject({ status: 404 });
  });

  it('revokes an in-scope session', async () => {
    const repo = makeRepo();
    await new SessionsService(repo).revoke(ORG, 's1', 'lead', only('target'), 'mine');
    expect(repo.revoke).toHaveBeenCalledWith('s1');
  });

  it('keeps the caller signed in when they revoke all of their own sessions', async () => {
    const repo = makeRepo();
    await new SessionsService(repo).revokeAllForUser(ORG, 'admin', 'admin', ALL, 'mine');
    expect(repo.revokeAllForUser).toHaveBeenCalledWith(ORG, 'admin', 'mine');
  });

  it('revokes every session when targeting another user', async () => {
    const repo = makeRepo();
    const result = await new SessionsService(repo).revokeAllForUser(
      ORG,
      'target',
      'admin',
      ALL,
      'mine'
    );
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
