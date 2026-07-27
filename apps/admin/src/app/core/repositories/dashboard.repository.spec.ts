import { TestBed } from '@angular/core/testing';
import { DashboardRepository } from './dashboard.repository';
import { DashboardApiService } from '@core/api/dashboard.api';
import { of } from 'rxjs';

describe('DashboardRepository', () => {
  let repository: DashboardRepository;
  let apiMock: jasmine.SpyObj<DashboardApiService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('DashboardApiService', [
      'getDashboardStats',
      'getDashboardActivities',
    ]);

    TestBed.configureTestingModule({
      providers: [
        DashboardRepository,
        { provide: DashboardApiService, useValue: spy },
      ],
    });

    repository = TestBed.inject(DashboardRepository);
    apiMock = TestBed.inject(DashboardApiService) as jasmine.SpyObj<DashboardApiService>;
  });

  it('should load stats and update signal', () => {
    const mockStats = { totalProjects: 10 };
    apiMock.getDashboardStats.and.returnValue(of(mockStats));

    repository.loadDashboardData().subscribe(() => {
      expect(repository.stats()).toEqual(mockStats);
      expect(repository.loading()).toBeFalse();
    });
  });
});
