import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiDataService } from '../http/api-data.service';
import { NotificationMessage, NotificationTemplate } from '@shared/models';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly apiData = inject(ApiDataService);

  getNotifications(params?: any): Observable<NotificationMessage[]> {
    return this.apiData.getData<NotificationMessage[]>('/notifications', params);
  }

  sendBroadcast(payload: { title: string; body: string; channels: string[] }): Observable<NotificationMessage> {
    return this.apiData.postData<NotificationMessage>('/notifications/broadcast', payload);
  }

  getTemplates(): Observable<NotificationTemplate[]> {
    return this.apiData.getData<NotificationTemplate[]>('/notifications/templates');
  }

  saveTemplate(template: Partial<NotificationTemplate>): Observable<NotificationTemplate> {
    return this.apiData.postData<NotificationTemplate>('/notifications/templates', template);
  }
}
