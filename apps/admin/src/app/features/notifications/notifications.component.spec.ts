import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NotificationsComponent } from './notifications.component';
import { NotificationRepository } from '@core/repositories/notification.repository';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let repoMock: jasmine.SpyObj<NotificationRepository>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('NotificationRepository', ['loadNotifications', 'loadTemplates', 'sendBroadcast']);
    spy.loadNotifications.and.returnValue(of([]));
    spy.loadTemplates.and.returnValue(of([]));
    spy.sendBroadcast.and.returnValue(of({} as any));

    TestBed.configureTestingModule({
      imports: [FormsModule, NotificationsComponent],
      providers: [
        { provide: NotificationRepository, useValue: spy },
      ],
    });

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    repoMock = TestBed.inject(NotificationRepository) as jasmine.SpyObj<NotificationRepository>;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
