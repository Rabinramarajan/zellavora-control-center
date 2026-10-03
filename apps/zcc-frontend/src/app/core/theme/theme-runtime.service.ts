import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { ThemesApiService } from '../api/themes.api';
import { ThemeService } from '../services/theme.service';
import { Theme, ThemeFont } from '../../shared/models/theme-builder.model';
import { BRAND_SHADES, brandPalette, isHexColor } from '../../shared/utils/brand-palette';

const SYSTEM_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
/** Already loaded by index.html, so no extra stylesheet is needed for them. */
const PRELOADED_FONTS: ReadonlySet<ThemeFont> = new Set(['Outfit', 'Inter', 'System']);
const FONT_LINK_ID = 'zcc-theme-font';

/** CSS `font-family` value for a theme font, falling back to the app's own stack. */
export const fontStack = (font: ThemeFont): string =>
  font === 'System' ? SYSTEM_STACK : `'${font}', 'Outfit', ${SYSTEM_STACK}`;

/** Loads a Google Font once; harmless to call repeatedly. */
export const ensureFontLoaded = (doc: Document, font: ThemeFont): void => {
  if (PRELOADED_FONTS.has(font)) return;
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
  if (doc.head.querySelector(`link[data-font="${font}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset['font'] = font;
  if (!doc.getElementById(FONT_LINK_ID)) link.id = FONT_LINK_ID;
  doc.head.appendChild(link);
};

/** Every CSS variable a theme sets on <html>, so a reset can remove exactly these. */
const THEME_VARS = [
  ...BRAND_SHADES.map((s) => `--brand-${s}`),
  '--app-radius',
  '--app-font',
  '--zv-accent',
  '--zv-font',
  '--zv-radius-control',
  '--zv-control-height',
  '--app-spacing',
  '--color-success',
  '--color-warning',
  '--color-error',
  '--color-info',
  'font-size',
];

/**
 * Applies the organization's active theme to the whole app: the brand palette behind every
 * `indigo-*` utility, the form-control accent, font and corner radius, and the favicon.
 */
@Injectable({ providedIn: 'root' })
export class ThemeRuntimeService {
  private readonly doc = inject(DOCUMENT);
  private readonly api = inject(ThemesApiService);
  private readonly auth = inject(AuthStore);
  private readonly appearance = inject(ThemeService);

  private readonly current = signal<Theme | null>(null);
  /** The theme currently applied (null until signed in and loaded). */
  public readonly active = this.current.asReadonly();
  public readonly logoUrl = computed(() => this.current()?.logoUrl ?? null);

  private defaultFavicon: string | null = null;
  private loadedFor: string | null = null;

  public constructor() {
    // Reload whenever the signed-in organization changes; clear on sign-out.
    effect(() => {
      const tenantId = this.auth.isAuthenticated() ? this.auth.tenantId() : null;
      if (tenantId === this.loadedFor) return;
      this.loadedFor = tenantId;
      if (tenantId) void this.load();
      else this.reset();
    });
  }

  public async load(): Promise<void> {
    try {
      this.apply(await firstValueFrom(this.api.active()));
    } catch {
      // Branding is cosmetic: on failure the app keeps its built-in look.
    }
  }

  public apply(theme: Theme): void {
    if (!isHexColor(theme.primaryColor)) return;
    const root = this.doc.documentElement.style;
    const palette = brandPalette(theme.primaryColor);
    for (const shade of BRAND_SHADES) root.setProperty(`--brand-${shade}`, palette[shade]);
    const font = fontStack(theme.fontFamily);
    ensureFontLoaded(this.doc, theme.fontFamily);
    root.setProperty('--app-font', font);
    root.setProperty('--zv-font', font);
    root.setProperty('--app-radius', `${theme.borderRadius}px`);
    root.setProperty('--zv-radius-control', `${theme.borderRadius}px`);
    root.setProperty('--zv-accent', theme.primaryColor);
    // Tailwind sizes are rem-based, so the base font size scales the whole interface.
    root.setProperty('font-size', `${theme.fontSize}px`);
    root.setProperty('--app-spacing', `${theme.spacing}px`);
    // 44px controls at the default 4px unit; denser or roomier with the spacing scale.
    root.setProperty('--zv-control-height', `${28 + theme.spacing * 4}px`);
    root.setProperty('--color-success', theme.successColor);
    root.setProperty('--color-warning', theme.warningColor);
    root.setProperty('--color-error', theme.errorColor);
    root.setProperty('--color-info', theme.infoColor);
    this.setFavicon(theme.faviconUrl);
    this.appearance.applyOrganizationDefault(theme.mode);
    this.current.set(theme);
  }

  private reset(): void {
    const root = this.doc.documentElement.style;
    for (const name of THEME_VARS) root.removeProperty(name);
    this.setFavicon(null);
    this.current.set(null);
  }

  private setFavicon(url: string | null): void {
    const link = this.doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) return;
    this.defaultFavicon ??= link.getAttribute('href');
    link.href = url ?? this.defaultFavicon ?? 'favicon.png';
  }
}
