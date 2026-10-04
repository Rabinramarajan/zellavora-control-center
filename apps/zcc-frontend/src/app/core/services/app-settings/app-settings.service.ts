import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

/** Shape of public/assets/app.settings.json. */
export interface AppSettings {
  logLevel: string;
  supabaseFunctions: string;
  adminPath: string;
  encrypt: boolean;
  serverDateFormat: string;
  serverDateTimeFormat: string;
  serverTimeFormat: string;
  dateViewFormat: string;
  dateViewFormatWithTime: string;
  clientCode: string;
  dbName: string;
  fileAccept: string;
  fileSizeErrorMsg: string;
  fileAcceptPDF: string;
  maxFileSize: number;
  fileFormatErrorMsg: string;
  pageSizeOptions: number[];
  wordLimits: number;
  httpErrorMsg: {
    default: string;
    error404: string;
    error401: string;
  };
  [key: string]: unknown;
}

const DEFAULT_SETTINGS: AppSettings = {
  logLevel: 'info',
  supabaseFunctions: 'https://api.zellavora.com/api/v1',
  adminPath: 'https://api.zellavora.com/admin',
  encrypt: true,
  serverDateFormat: 'YYYY-MM-DD',
  serverDateTimeFormat: 'YYYY-MM-DD HH:mm:ss',
  serverTimeFormat: 'HH:mm:ss',
  dateViewFormat: 'dd MMM yyyy',
  dateViewFormatWithTime: 'dd MMM yyyy HH:mm',
  clientCode: 'ZCC',
  dbName: '__ZCC_DB__',
  fileAccept: 'application/pdf, image/*',
  fileSizeErrorMsg:
    '{1} File size exceeds the limit of {0} and will not be uploaded.',
  fileAcceptPDF: 'application/pdf',
  maxFileSize: 2097152,
  fileFormatErrorMsg:
    'For enhanced security, we request that you convert the file into PDF, JPG, PNG format.',
  pageSizeOptions: [10, 20, 50],
  wordLimits: 5000,
  httpErrorMsg: {
    default:
      'We are currently facing some technical issues right now. Please try again after some time.',
    error404: 'Unable to reach Server Error code: 404',
    error401: 'Your session expired. Please login again to continue.',
  },
};

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
      this.http.get<AppSettings>('/assets/app.settings.json', {
        params: { v: Date.now() }, // cache-buster
      }),
    );
    this._settings.set({ ...DEFAULT_SETTINGS, ...config });
  }
}
