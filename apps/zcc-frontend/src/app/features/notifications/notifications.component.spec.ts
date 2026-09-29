import { TestBed, ComponentFixture } from '@angular/core/testing';
import { NotificationsComponent } from './notifications.component';
import { NotificationRepository } from '@core/repositories/notification.repository';
import { of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { signal } from '@angular/core';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('NotificationRepository', ['loadNotifications', 'loadTemplates', 'sendBroadcast'], {
      templates: signal([]),
      notifications: signal([]),
    });
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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
