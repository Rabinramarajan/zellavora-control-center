import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

/** Shape of public/app.settings.json. Add your real keys here. */
export interface AppSettings {
  encrypt: boolean;
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = { encrypt: false };

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly http = inject(HttpClient);

  private readonly _settings = signal<AppSettings>(DEFAULT_SETTINGS);

  /** Read-only signal for use in components, computed(), effect(). */
  readonly settings = this._settings.asReadonly();

  /** Observable stream, replacing the old settingsChanges getter. */
  readonly settingsChanges$ = toObservable(this._settings);

  /** Drop-in replacement for the old `environment` property. */
  get environment(): AppSettings {
    return this._settings();
  }

  /** Loads the config once at startup and stores it. */
  async load(): Promise<void> {
    const config = await firstValueFrom(
      this.http.get<AppSettings>('./app.settings.json', {
        params: { v: Date.now() }, // cache-buster
      }),
    );
    this._settings.set({ ...DEFAULT_SETTINGS, ...config });
  }
}