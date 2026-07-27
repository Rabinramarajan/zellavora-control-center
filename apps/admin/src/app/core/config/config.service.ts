import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  private http = inject(HttpClient);
  private config: any = null;

  loadConfig() {
    const configFile = environment.production ? 'appsettings.json' : 'appsettings.development.json';
    return this.http.get(`/assets/${configFile}`).pipe(
      tap((config) => {
        this.config = config;
      }),
      catchError((error) => {
        console.warn(`Failed to load environment configuration: ${configFile}. Falling back to default appsettings.json`, error);
        return this.http.get('/assets/appsettings.json').pipe(
          tap((fallbackConfig) => {
            this.config = fallbackConfig;
          })
        );
      })
    );
  }

  get(key: string): any {
    if (!this.config) return null;
    return key.split('.').reduce((acc, part) => acc && acc[part], this.config);
  }
}
