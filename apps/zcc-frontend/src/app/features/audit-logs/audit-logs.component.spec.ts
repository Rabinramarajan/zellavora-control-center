import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AuditLogsComponent } from './audit-logs.component';
import { AuditRepository } from '@core/repositories/audit.repository';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';

describe('AuditLogsComponent', () => {
  let component: AuditLogsComponent;
  let fixture: ComponentFixture<AuditLogsComponent>;
  let repoMock: jasmine.SpyObj<AuditRepository>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuditRepository', ['loadAuditLogs', 'exportLogs']);
    spy.loadAuditLogs.and.returnValue(of([]));
    spy.logs = jasmine.createSpy().and.returnValue([]);

    TestBed.configureTestingModule({
      imports: [FormsModule, AuditLogsComponent],
      providers: [
        { provide: AuditRepository, useValue: spy },
      ],
    });

    fixture = TestBed.createComponent(AuditLogsComponent);
    component = fixture.componentInstance;
    repoMock = TestBed.inject(AuditRepository) as jasmine.SpyObj<AuditRepository>;
    
    // Workaround for getter properties in jasmine spy
    Object.defineProperty(repoMock, 'logs', { value: () => [] });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
