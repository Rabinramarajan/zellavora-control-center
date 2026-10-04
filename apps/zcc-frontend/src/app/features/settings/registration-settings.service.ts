import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  RegistrationSettings,
  RegistrationSettingsPayload,
} from './models/registration-settings.model';

interface Envelope<T> {
  success: boolean;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class RegistrationSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/settings/registration';

  get(): Observable<RegistrationSettings> {
    return this.http.get<Envelope<RegistrationSettings>>(this.baseUrl).pipe(map((res) => res.data));
  }

  update(payload: RegistrationSettingsPayload): Observable<RegistrationSettings> {
    return this.http
      .put<Envelope<RegistrationSettings>>(this.baseUrl, payload)
      .pipe(map((res) => res.data));
  }
}
