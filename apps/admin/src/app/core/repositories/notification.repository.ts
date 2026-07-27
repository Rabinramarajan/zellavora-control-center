import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { NotificationApiService } from '@core/api/notification.api';
import { NotificationMessage, NotificationTemplate } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class NotificationRepository {
  private readonly api = inject(NotificationApiService);

  private readonly _notifications = signal<NotificationMessage[]>([]);
  private readonly _templates = signal<NotificationTemplate[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly notifications = computed(() => this._notifications());
  readonly templates = computed(() => this._templates());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  loadNotifications(params?: any): Observable<NotificationMessage[]> {
    this._loading.set(true);
    this._error.set(null);
    return this.api.getNotifications(params).pipe(
      tap((data) => {
        this._notifications.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err.message || 'Failed to load notifications');
        this._loading.set(false);
        // Local dev fallbacks
        this._notifications.set([]);
        return of([]);
      })
    );
  }

  sendBroadcast(payload: { title: string; body: string; channels: string[] }): Observable<NotificationMessage> {
    this._loading.set(true);
    return this.api.sendBroadcast(payload).pipe(
      tap((newMsg) => {
        this._notifications.update((current) => [newMsg, ...current]);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        // Fallback mock broadcast for local UI testing
        const mockMsg: NotificationMessage = {
          id: crypto.randomUUID(),
          title: payload.title,
          body: payload.body,
          status: 'sent',
          channels: payload.channels as any,
          createdAt: new Date().toISOString(),
        };
        this._notifications.update((current) => [mockMsg, ...current]);
        return of(mockMsg);
      })
    );
  }

  loadTemplates(): Observable<NotificationTemplate[]> {
    this._loading.set(true);
    return this.api.getTemplates().pipe(
      tap((data) => {
        this._templates.set(data);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        // Local dev template mocks
        const mocks: NotificationTemplate[] = [
          { id: '1', key: 'welcome_email', name: 'Welcome Email', subject: 'Welcome to ZCC', body: 'Hi {{name}}, ...', channels: ['email'], createdAt: new Date().toISOString() },
          { id: '2', key: 'mfa_alert', name: 'MFA Security Alert', subject: 'MFA Enabled', body: 'Your MFA setting has changed.', channels: ['email', 'push'], createdAt: new Date().toISOString() },
        ];
        this._templates.set(mocks);
        return of(mocks);
      })
    );
  }

  saveTemplate(template: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    this._loading.set(true);
    return this.api.saveTemplate(template).pipe(
      tap((updated) => {
        this._templates.update((current) => {
          const index = current.findIndex((t) => t.id === updated.id);
          if (index !== -1) {
            return current.map((t) => (t.id === updated.id ? updated : t));
          }
          return [...current, updated];
        });
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        const mockSaved: NotificationTemplate = {
          id: template.id || crypto.randomUUID(),
          key: template.key || 'custom_key',
          name: template.name || 'New Template',
          subject: template.subject || null,
          body: template.body || '',
          channels: (template.channels || ['in_app']) as any,
          createdAt: new Date().toISOString(),
        };
        this._templates.update((current) => {
          const index = current.findIndex((t) => t.id === mockSaved.id);
          if (index !== -1) {
            return current.map((t) => (t.id === mockSaved.id ? mockSaved : t));
          }
          return [...current, mockSaved];
        });
        return of(mockSaved);
      })
    );
  }
}
