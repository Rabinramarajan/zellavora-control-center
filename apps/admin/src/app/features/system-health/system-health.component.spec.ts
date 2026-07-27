import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SystemHealthComponent } from './system-health.component';
import { SystemHealthRepository } from '@core/repositories/system-health.repository';
import { of } from 'rxjs';

describe('SystemHealthComponent', () => {
  let component: SystemHealthComponent;
  let fixture: ComponentFixture<SystemHealthComponent>;
  let repoMock: jasmine.SpyObj<SystemHealthRepository>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('SystemHealthRepository', ['loadHealthMetrics']);
    spy.loadHealthMetrics.and.returnValue(of({
      cpu: { used: 1, total: 4, percentage: 25 },
      ram: { used: 4, total: 8, percentage: 50 },
      database: { status: 'healthy', latencyMs: 10 },
      storage: { status: 'healthy', latencyMs: 20 },
      redis: { status: 'healthy', latencyMs: 5 },
      queue: { pendingJobs: 0, activeWorkers: 1, status: 'healthy' },
      timestamp: new Date().toISOString(),
    }));

    TestBed.configureTestingModule({
      imports: [SystemHealthComponent],
      providers: [
        { provide: SystemHealthRepository, useValue: spy },
      ],
    });

    fixture = TestBed.createComponent(SystemHealthComponent);
    component = fixture.componentInstance;
    repoMock = TestBed.inject(SystemHealthRepository) as jasmine.SpyObj<SystemHealthRepository>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
