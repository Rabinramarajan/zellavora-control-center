import { DashboardService } from './dashboard.service';
import type { DashboardRepository } from './dashboard.repository';
import type { DashboardScope } from './dashboard.scope';

const ORG = '11111111-1111-1111-1111-111111111111';
const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const orgScope: DashboardScope = { kind: 'organization', organizationId: ORG };
const individualA: DashboardScope = { kind: 'individual', organizationId: ORG, userId: USER_A };
const individualB: DashboardScope = { kind: 'individual', organizationId: ORG, userId: USER_B };

/** Records the scope each call received so we can assert it is always passed. */
function repoStub(): { repo: DashboardRepository; scopes: DashboardScope[] } {
  const scopes: DashboardScope[] = [];
  const num = (n: number) => jest.fn(async (s: DashboardScope) => (scopes.push(s), n));
  const numSince = jest.fn(async (s: DashboardScope) => (scopes.push(s), 0));
  const trend = jest.fn(async (s: DashboardScope) => (scopes.push(s), []));

  const repo = {
    countOrganizations: num(1),
    countMembers: num(2),
    countActiveSessions: num(3),
    countPendingInvitations: num(4),
    countProjects: num(5),
    countDailySheets: num(6),
    countMediaFiles: num(7),
    countPortfolioProjects: num(8),
    countAuditEventsSince: numSince,
    countCriticalAlertsSince: numSince,
    orgSignupsSince: trend,
    memberSignupsSince: trend,
    projectsCreatedSince: trend,
    sheetsLoggedSince: trend,
    auditTrendSince: trend,
    recentAuditEvents: jest.fn(async (s: DashboardScope) => (scopes.push(s), [])),
    recentAuditEventsPaginated: jest.fn(async (s: DashboardScope) => (scopes.push(s), [])),
    countAuditEvents: jest.fn(async (s: DashboardScope) => (scopes.push(s), 0)),
    planDistribution: jest.fn(async (s: DashboardScope) => (scopes.push(s), [])),
    contentDistribution: jest.fn(async (s: DashboardScope) => (scopes.push(s), [])),
  } as unknown as DashboardRepository;

  return { repo, scopes };
}

describe('DashboardService.getOverview', () => {
  it('passes the scope to every repository call for an organization', async () => {
    const { repo, scopes } = repoStub();
    await new DashboardService(repo).getOverview('30', orgScope);

    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.every((s) => s === orgScope)).toBe(true);
  });

  it('passes the scope to every repository call for an individual', async () => {
    const { repo, scopes } = repoStub();
    await new DashboardService(repo).getOverview('30', individualA);

    expect(scopes.length).toBeGreaterThan(0);
    expect(scopes.every((s) => s === individualA)).toBe(true);
  });

  it('returns the org-wide KPI set for an organization account', async () => {
    const { repo } = repoStub();
    const overview = await new DashboardService(repo).getOverview('30', orgScope);

    expect(overview.scope).toBe('organization');
    expect(overview.kpis.map((k) => k.key)).toEqual([
      'organizations',
      'members',
      'activeSessions',
      'pendingInvitations',
      'auditEvents24h',
      'criticalAlerts24h',
    ]);
    expect(overview.panel.title).toBe('Plan Distribution');
  });

  it('returns a personal KPI set with no org-wide metrics for an individual', async () => {
    const { repo } = repoStub();
    const overview = await new DashboardService(repo).getOverview('30', individualA);

    expect(overview.scope).toBe('individual');
    expect(overview.kpis.map((k) => k.key)).toEqual([
      'projects',
      'sheets',
      'mediaFiles',
      'activeSessions',
      'auditEvents24h',
      'criticalAlerts24h',
    ]);
    expect(overview.kpis.map((k) => k.key)).not.toContain('organizations');
    expect(overview.kpis.map((k) => k.key)).not.toContain('members');
    expect(overview.kpis.map((k) => k.key)).not.toContain('pendingInvitations');
    expect(overview.panel.title).toBe('My Workspace');
  });

  it('never calls organization-wide counts for an individual', async () => {
    const { repo } = repoStub();
    await new DashboardService(repo).getOverview('30', individualA);

    expect(repo.countOrganizations).not.toHaveBeenCalled();
    expect(repo.countMembers).not.toHaveBeenCalled();
    expect(repo.countPendingInvitations).not.toHaveBeenCalled();
    expect(repo.planDistribution).not.toHaveBeenCalled();
  });

  it('does not serve one individual a cached payload computed for another', async () => {
    const { repo } = repoStub();
    const service = new DashboardService(repo);

    await service.getOverview('30', individualA);
    const callsAfterA = (repo.countProjects as jest.Mock).mock.calls.length;
    await service.getOverview('30', individualB);

    expect((repo.countProjects as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterA);
    expect((repo.countProjects as jest.Mock).mock.calls.at(-1)?.[0]).toEqual(individualB);
  });

  it('does not serve an individual the organization payload from cache', async () => {
    const { repo } = repoStub();
    const service = new DashboardService(repo);

    const org = await service.getOverview('30', orgScope);
    const individual = await service.getOverview('30', individualA);

    expect(org.scope).toBe('organization');
    expect(individual.scope).toBe('individual');
  });
});

describe('DashboardService.getActivityFeed', () => {
  it('applies the scope alongside the caller filters', async () => {
    const { repo } = repoStub();
    await new DashboardService(repo).getActivityFeed('30', 1, 20, individualA, {
      severity: 'critical',
    });

    expect(repo.recentAuditEventsPaginated).toHaveBeenCalledWith(
      individualA,
      expect.any(Date),
      { severity: 'critical' },
      1,
      20
    );
    expect(repo.countAuditEvents).toHaveBeenCalledWith(individualA, expect.any(Date), {
      severity: 'critical',
    });
  });
});
