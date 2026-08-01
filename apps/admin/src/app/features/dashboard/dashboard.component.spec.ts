import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component, input, signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { DashboardStore } from './dashboard.store';
import { DashboardOverview } from './dashboard.models';
import { ApexChartComponent } from '@shared/components/apex-chart/apex-chart.component';

@Component({ selector: 'app-apex-chart', standalone: true, template: '' })
class StubApexChartComponent {
  readonly chartConfig = input<unknown>({});
  readonly height = input<number | string>(280);
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const overview: DashboardOverview = {
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
      organizations: [{ date: '2026-07-01', count: 1 }],
      members: [{ date: '2026-07-01', count: 10 }],
      activity: [{ date: '2026-07-01', count: 40 }],
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
  };

  beforeEach(async () => {
    const storeStub = {
      range: signal<'7' | '30' | '90'>('30'),
      loadingOverview: signal(false),
      loadingActivity: signal(false),
      hasOverview: signal(false),
      errorOverview: signal<string | null>(null),
      errorActivity: signal<string | null>(null),
      kpis: signal(overview.kpis),
      trends: signal(overview.trends),
      recentActivity: signal(overview.activity),
      planDistribution: signal(overview.planDistribution),
      activity: signal({ items: overview.activity, total: 1, page: 1, pageSize: 20 }),
      activityFilters: signal({}),
      trendLabels: signal(['Jul 1']),
      activitySeries: signal([40]),
      membersSeries: signal([10]),
      orgsSeries: signal([1]),
      overview: signal(overview),
      isStale: signal(false),
      loadOverview: jasmine.createSpy('loadOverview'),
      loadActivity: jasmine.createSpy('loadActivity'),
      setRange: jasmine.createSpy('setRange'),
      setActivityFilters: jasmine.createSpy('setActivityFilters'),
      refreshAll: jasmine.createSpy('refreshAll'),
    } as unknown as DashboardStore;

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideRouter([]), { provide: DashboardStore, useValue: storeStub }],
    })
      .overrideComponent(DashboardComponent, {
        remove: { imports: [ApexChartComponent] },
        add: { imports: [StubApexChartComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
});
