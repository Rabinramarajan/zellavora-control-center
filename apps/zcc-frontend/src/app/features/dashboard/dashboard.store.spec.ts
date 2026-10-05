import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardStore } from './dashboard.store';
import { DashboardApiService } from './dashboard.api';
import { DashboardOverview, ActivityFeedPage, ApiEnvelope } from './dashboard.models';

describe('DashboardStore', () => {
  let store: DashboardStore;
  let apiMock: jasmine.SpyObj<DashboardApiService>;

  const overviewEnvelope: ApiEnvelope<DashboardOverview> = {
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      scope: 'organization',
      kpis: [
        {
          key: 'organizations',
          label: 'Organizations',
          value: 12,
          hint: 'Active tenants',
          series: 'primary',
        },
        {
          key: 'members',
          label: 'Members',
          value: 340,
          hint: 'Active accounts',
          series: 'secondary',
        },
        {
          key: 'activeSessions',
          label: 'Active Sessions',
          value: 58,
          hint: 'Live sessions',
          series: null,
        },
        {
          key: 'pendingInvitations',
          label: 'Pending Invites',
          value: 7,
          hint: 'Awaiting acceptance',
          series: null,
        },
        {
          key: 'auditEvents24h',
          label: 'Audit Events',
          value: 890,
          hint: 'Last 24 hours',
          series: 'activity',
        },
        {
          key: 'criticalAlerts24h',
          label: 'Critical Alerts',
          value: 2,
          hint: 'Last 24 hours',
          series: null,
        },
      ],
      trendLegend: { primary: 'Organizations', secondary: 'Members' },
      trends: {
        primary: [
          { date: '2026-07-01', count: 1 },
          { date: '2026-07-02', count: 2 },
        ],
        secondary: [
          { date: '2026-07-01', count: 10 },
          { date: '2026-07-02', count: 12 },
        ],
        activity: [
          { date: '2026-07-01', count: 40 },
          { date: '2026-07-02', count: 55 },
        ],
      },
      activity: [
        {
          id: 'a1',
          actorId: 'u1',
          actorEmail: 'owner@zcc.io',
          action: 'login',
          resource: 'session',
          severity: 'info',
          createdAt: new Date().toISOString(),
        },
      ],
      panel: {
        title: 'Plan Distribution',
        subtitle: 'Organization subscription plans.',
        chip: 'Organizations',
        totalLabel: 'Total Organizations',
        emptyTitle: 'No plans',
        emptyHint: 'No organization plans recorded.',
      },
      planDistribution: [
        { plan: 'free', count: 4 },
        { plan: 'enterprise', count: 8 },
      ],
    },
  };

  const activityEnvelope: ApiEnvelope<ActivityFeedPage> = {
    success: true,
    data: {
      items: [
        {
          id: 'a1',
          actorId: 'u1',
          actorEmail: 'owner@zcc.io',
          action: 'login',
          resource: 'session',
          severity: 'info',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    },
  };

  beforeEach(() => {
    const spy = jasmine.createSpyObj('DashboardApiService', ['getOverview', 'getActivityFeed']);
    spy.getOverview.and.returnValue(of(overviewEnvelope));
    spy.getActivityFeed.and.returnValue(of(activityEnvelope));

    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: DashboardApiService, useValue: spy }],
    });

    store = TestBed.inject(DashboardStore);
    apiMock = TestBed.inject(DashboardApiService) as jasmine.SpyObj<DashboardApiService>;
  });

  it('should create', () => {
    expect(store).toBeTruthy();
  });

  it('starts empty with default 30d range', () => {
    expect(store.range()).toBe('30');
    expect(store.hasOverview()).toBe(false);
    expect(store.isStale()).toBe(true);
  });

  it('loads overview and populates KPIs and derived chart series', async () => {
    await store.loadOverview('30');

    expect(store.hasOverview()).toBe(true);
    expect(store.isStale()).toBe(false);
    expect(store.scope()).toBe('organization');
    expect(store.kpis().map((k) => [k.key, k.value])).toEqual([
      ['organizations', 12],
      ['members', 340],
      ['activeSessions', 58],
      ['pendingInvitations', 7],
      ['auditEvents24h', 890],
      ['criticalAlerts24h', 2],
    ]);

    expect(store.trendLabels().length).toBe(2);
    expect(store.activitySeries()).toEqual([40, 55]);
    expect(store.secondarySeries()).toEqual([10, 12]);
    expect(store.primarySeries()).toEqual([1, 2]);
    expect(store.seriesFor('activity')).toEqual([40, 55]);
    expect(store.seriesFor(null)).toEqual([]);
    expect(store.recentActivity().length).toBe(1);
    expect(store.planDistribution()).toEqual([
      { plan: 'free', count: 4 },
      { plan: 'enterprise', count: 8 },
    ]);
    expect(apiMock.getOverview).toHaveBeenCalledWith('30');
  });

  it('setRange reloads the overview with the new window', async () => {
    store.setRange('7');
    expect(store.range()).toBe('7');
    expect(apiMock.getOverview).toHaveBeenCalledWith('7');
  });

  it('captures load errors without breaking state', async () => {
    apiMock.getOverview.and.returnValue(
      throwError(() => ({
        error: { error: { message: 'boom' } },
      }))
    );
    await store.loadOverview('30');

    expect(store.errorOverview()).toBe('boom');
    expect(store.loadingOverview()).toBe(false);
  });

  it('loads the paginated activity feed', async () => {
    await store.loadActivity(1);

    expect(store.activity()?.items.length).toBe(1);
    expect(store.activity()?.total).toBe(1);
    expect(store.activity()?.page).toBe(1);
    expect(apiMock.getActivityFeed).toHaveBeenCalledWith('30', 1, 8, {});
  });

  it('applies severity filters and reloads from page 1', async () => {
    store.setActivityFilters({ severity: 'critical' });

    expect(store.activityFilters().severity).toBe('critical');
    expect(apiMock.getActivityFeed).toHaveBeenCalledWith('30', 1, 8, {
      severity: 'critical',
    });
  });

  it('reset restores the initial state', async () => {
    await store.loadOverview('30');
    store.reset();

    expect(store.hasOverview()).toBe(false);
    expect(store.range()).toBe('30');
    expect(store.isStale()).toBe(true);
  });
});
