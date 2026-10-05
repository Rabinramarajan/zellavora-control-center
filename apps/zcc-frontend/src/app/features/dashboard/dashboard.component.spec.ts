import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { DashboardStore } from './dashboard.store';
import { DashboardOverview, TrendSeriesKey } from './dashboard.models';

const sampleActivity = [
  {
    id: 'a1',
    actorId: 'u1',
    actorEmail: 'owner@zcc.io',
    action: 'login',
    resource: 'session',
    severity: 'info' as const,
    createdAt: new Date().toISOString(),
  },
];

const organizationOverview: DashboardOverview = {
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
    { key: 'members', label: 'Members', value: 340, hint: 'Active accounts', series: 'secondary' },
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
    primary: [{ date: '2026-07-01', count: 1 }],
    secondary: [{ date: '2026-07-01', count: 10 }],
    activity: [{ date: '2026-07-01', count: 40 }],
  },
  activity: sampleActivity,
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
};

const individualOverview: DashboardOverview = {
  generatedAt: new Date().toISOString(),
  scope: 'individual',
  kpis: [
    { key: 'projects', label: 'My Projects', value: 7, hint: 'Created by you', series: 'primary' },
    { key: 'sheets', label: 'My Sheets', value: 12, hint: 'Daily sheets logged', series: null },
  ],
  trendLegend: { primary: 'Projects', secondary: 'Sheets' },
  trends: {
    primary: [{ date: '2026-07-01', count: 2 }],
    secondary: [{ date: '2026-07-01', count: 3 }],
    activity: [{ date: '2026-07-01', count: 5 }],
  },
  activity: sampleActivity,
  panel: {
    title: 'My Workspace',
    subtitle: 'How your content breaks down.',
    chip: 'Personal',
    totalLabel: 'Total Items',
    emptyTitle: 'Nothing here yet',
    emptyHint: 'Create a project or log a sheet to get started.',
  },
  planDistribution: [{ plan: 'Projects', count: 7 }],
};

function storeStubFor(overview: DashboardOverview): DashboardStore {
  return {
    range: signal<'7' | '30' | '90'>('30'),
    loadingOverview: signal(false),
    loadingActivity: signal(false),
    hasOverview: signal(true),
    errorOverview: signal<string | null>(null),
    errorActivity: signal<string | null>(null),
    kpis: signal(overview.kpis),
    trends: signal(overview.trends),
    scope: signal(overview.scope),
    panel: signal(overview.panel),
    trendLegend: signal(overview.trendLegend),
    recentActivity: signal(overview.activity),
    planDistribution: signal(overview.planDistribution),
    activity: signal({ items: overview.activity, total: 1, page: 1, pageSize: 8 }),
    activityFilters: signal({}),
    activityPageSize: signal(8),
    setActivityPageSize: jasmine.createSpy('setActivityPageSize'),
    trendLabels: signal(['Jul 1']),
    activitySeries: signal(overview.trends.activity.map((p) => p.count)),
    primarySeries: signal(overview.trends.primary.map((p) => p.count)),
    secondarySeries: signal(overview.trends.secondary.map((p) => p.count)),
    seriesFor: (key: TrendSeriesKey | null) =>
      key ? overview.trends[key].map((p) => p.count) : [],
    pointsFor: (key: TrendSeriesKey | null) => (key ? overview.trends[key] : []),
    overview: signal(overview),
    isStale: signal(false),
    loadOverview: jasmine.createSpy('loadOverview'),
    loadActivity: jasmine.createSpy('loadActivity'),
    setRange: jasmine.createSpy('setRange'),
    setActivityFilters: jasmine.createSpy('setActivityFilters'),
    refreshAll: jasmine.createSpy('refreshAll'),
  } as unknown as DashboardStore;
}

async function mount(overview: DashboardOverview): Promise<ComponentFixture<DashboardComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [provideRouter([]), { provide: DashboardStore, useValue: storeStubFor(overview) }],
  }).compileComponents();

  const fixture = TestBed.createComponent(DashboardComponent);
  fixture.detectChanges();
  return fixture;
}

describe('DashboardComponent', () => {
  describe('organization scope', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;

    beforeEach(async () => {
      fixture = await mount(organizationOverview);
      component = fixture.componentInstance;
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('exposes a setRangeValue template helper that casts to DashboardRange', () => {
      const store = TestBed.inject(DashboardStore) as unknown as { setRange: jasmine.Spy };
      component.setRangeValue('7');
      expect(store.setRange).toHaveBeenCalledWith('7');
    });

    it('hasTrendData is true when the trends series has points', () => {
      expect(component.hasTrendData()).toBe(true);
    });

    it('renders the six KPI values', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('12');
      expect(el.textContent).toContain('340');
      expect(el.textContent).toContain('58');
      expect(el.textContent).toContain('890');
      expect(el.textContent).toContain('2');
    });

    it('renders the range toggle with 7d/30d/90d options', () => {
      const el = fixture.nativeElement as HTMLElement;
      const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(buttons).toContain('7d');
      expect(buttons).toContain('30d');
      expect(buttons).toContain('90d');
    });

    it('keeps the organization-only quick actions', () => {
      expect(component.visibleQuickActions().map((a) => a.title)).toContain('Invite Member');
    });

    it('renders the plan distribution panel copy', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain('Plan Distribution');
    });
  });

  describe('individual scope', () => {
    let component: DashboardComponent;
    let fixture: ComponentFixture<DashboardComponent>;

    beforeEach(async () => {
      fixture = await mount(individualOverview);
      component = fixture.componentInstance;
    });

    it('renders the personal KPI set the API supplied', () => {
      expect(component.kpiCards().map((c) => c.label)).toEqual(['My Projects', 'My Sheets']);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('My Projects');
    });

    it('swaps the donut panel copy for the personal workspace breakdown', () => {
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('My Workspace');
      expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Plan Distribution');
    });

    it('drops quick actions an individual account has no permission for', () => {
      const titles = component.visibleQuickActions().map((a) => a.title);
      expect(titles).not.toContain('Invite Member');
      expect(titles).not.toContain('Settings');
      expect(titles).toContain('Create Sheet');
    });

    it('labels the trend legend with the personal series name', () => {
      expect(component.trendSeries().map((s) => s.name)).toEqual(['Activity', 'Sheets']);
    });
  });
});
