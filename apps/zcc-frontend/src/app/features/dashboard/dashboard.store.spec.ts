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
      kpis: {
        organizations: 12,
        members: 340,
        activeSessions: 58,
        pendingInvitations: 7,
        auditEvents24h: 890,
        criticalAlerts24h: 2,
      },
      trends: {
        organizations: [
          { date: '2026-07-01', count: 1 },
          { date: '2026-07-02', count: 2 },
        ],
        members: [
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
    expect(store.kpis()?.organizations).toBe(12);
    expect(store.kpis()?.members).toBe(340);
    expect(store.kpis()?.activeSessions).toBe(58);
    expect(store.kpis()?.pendingInvitations).toBe(7);
    expect(store.kpis()?.auditEvents24h).toBe(890);
    expect(store.kpis()?.criticalAlerts24h).toBe(2);

    expect(store.trendLabels().length).toBe(2);
    expect(store.activitySeries()).toEqual([40, 55]);
    expect(store.membersSeries()).toEqual([10, 12]);
    expect(store.orgsSeries()).toEqual([1, 2]);
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
    apiMock.getOverview.and.returnValue(throwError(() => ({
      error: { error: { message: 'boom' } },
    })));
    await store.loadOverview('30');

    expect(store.errorOverview()).toBe('boom');
    expect(store.loadingOverview()).toBe(false);
  });

  it('loads the paginated activity feed', async () => {
    await store.loadActivity(1);

    expect(store.activity()?.items.length).toBe(1);
    expect(store.activity()?.total).toBe(1);
    expect(store.activity()?.page).toBe(1);
    expect(apiMock.getActivityFeed).toHaveBeenCalledWith('30', 1, 20, {});
  });

  it('applies severity filters and reloads from page 1', async () => {
    store.setActivityFilters({ severity: 'critical' });

    expect(store.activityFilters().severity).toBe('critical');
    expect(apiMock.getActivityFeed).toHaveBeenCalledWith('30', 1, 20, {
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
