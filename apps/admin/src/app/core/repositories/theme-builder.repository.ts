import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ThemeBuilderApiService } from '@core/api/theme-builder.api';
import { ThemeConfig } from '@shared/models';

const DEFAULT_THEME: ThemeConfig = {
  logoUrl: null,
  faviconUrl: null,
  primaryColor: '#3b82f6', // Tailwind blue-500
  secondaryColor: '#1e293b', // Tailwind slate-800
  fontFamily: 'Inter',
  borderRadius: 8,
  spacing: 4,
  isDarkMode: false,
};

@Injectable({ providedIn: 'root' })
export class ThemeBuilderRepository {
  private readonly api = inject(ThemeBuilderApiService);

  private readonly _config = signal<ThemeConfig>(DEFAULT_THEME);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly config = computed(() => this._config());
  readonly loading = computed(() => this._loading());
  readonly error = computed(() => this._error());

  constructor() {
    // Instantly inject CSS variables whenever configuration changes
    effect(() => {
      this.updateStyles(this.config());
    });
  }

  loadThemeConfig(): Observable<ThemeConfig> {
    this._loading.set(true);
    return this.api.getThemeConfig().pipe(
      tap((config) => {
        this._config.set(config);
        this._loading.set(false);
      }),
      catchError((err) => {
        // Fall back to default theme on dev/local errors
        this._config.set(DEFAULT_THEME);
        this._loading.set(false);
        return of(DEFAULT_THEME);
      })
    );
  }

  saveThemeConfig(config: Partial<ThemeConfig>): Observable<ThemeConfig> {
    this._loading.set(true);
    return this.api.updateThemeConfig(config).pipe(
      tap((updated) => {
        this._config.set(updated);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  uploadAsset(file: File, type: 'logo' | 'favicon'): Observable<{ url: string }> {
    this._loading.set(true);
    return this.api.uploadBrandingAsset(file, type).pipe(
      tap((res) => {
        this._config.update((current) => ({
          ...current,
          [type === 'logo' ? 'logoUrl' : 'faviconUrl']: res.url,
        }));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._loading.set(false);
        return throwError(() => err);
      })
    );
  }

  private updateStyles(config: ThemeConfig) {
    if (typeof document === 'undefined') return; // Safe for SSR

    let styleEl = document.getElementById('zcc-dynamic-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'zcc-dynamic-theme';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      :root {
        --primary-color: ${config.primaryColor};
        --secondary-color: ${config.secondaryColor};
        --font-family: '${config.fontFamily}', sans-serif;
        --border-radius: ${config.borderRadius}px;
        --base-spacing: ${config.spacing}px;
      }
    `;
  }
}
