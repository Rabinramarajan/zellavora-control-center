import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  EmailSettings,
  EmailSettingsPayload,
  EmailTestResult,
} from './models/email-settings.model';

interface Envelope<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class EmailSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/settings/email';

  get(): Observable<EmailSettings> {
    return this.http.get<Envelope<EmailSettings>>(this.baseUrl).pipe(map((res) => res.data));
  }

  update(payload: EmailSettingsPayload): Observable<EmailSettings> {
    return this.http
      .put<Envelope<EmailSettings>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }

  sendTest(to: string): Observable<EmailTestResult> {
    return this.http
      .post<Envelope<EmailTestResult>>(`${this.baseUrl}/test`, { to })
      .pipe(map((res) => res.data));
  }
}
