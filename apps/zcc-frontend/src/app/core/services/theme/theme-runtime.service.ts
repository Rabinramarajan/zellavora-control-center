import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ThemeFont, Theme } from '../../../shared/models';
import { brandPalette, BRAND_SHADES, isHexColor } from '../../../shared/utils/brand-palette';
import { AuthStore } from '../../auth/auth.store';
import { ThemeService } from './theme.service';
import { ThemesApiService } from '../../api/themes.api';


const SYSTEM_STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
/** Already loaded by index.html, so no extra stylesheet is needed for them. */
const PRELOADED_FONTS: ReadonlySet<ThemeFont> = new Set(['Outfit', 'Inter', 'System']);

/** 44px controls at the default 4px spacing unit; denser or roomier with the spacing scale. */
const CONTROL_BASE_HEIGHT = 28;
const CONTROL_HEIGHT_PER_SPACING = 4;

/** CSS `font-family` value for a theme font, falling back to the app's own stack. */
export const fontStack = (font: ThemeFont): string =>
  font === 'System' ? SYSTEM_STACK : `'${font}', 'Outfit', ${SYSTEM_STACK}`;

/** Loads a Google Font once; harmless to call repeatedly. */
export const ensureFontLoaded = (doc: Document, font: ThemeFont): void => {
  if (PRELOADED_FONTS.has(font) || doc.head.querySelector(`link[data-font="${font}"]`)) return;

  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
  link.dataset['font'] = font;
  doc.head.appendChild(link);
};

/** Every style a theme sets on <html>: the single source for both apply and reset. */
const themeStyles = (theme: Theme): Record<string, string> => {
  const palette = brandPalette(theme.primaryColor);
  const font = fontStack(theme.fontFamily);
  const radius = `${theme.borderRadius}px`;

  return {
    ...Object.fromEntries(BRAND_SHADES.map((shade) => [`--brand-${shade}`, palette[shade]] as const)),
    '--app-font': font,
    '--zv-font': font,
    '--app-radius': radius,
    '--zv-radius-control': radius,
    '--zv-accent': theme.primaryColor,
    '--app-spacing': `${theme.spacing}px`,
    '--zv-control-height': `${CONTROL_BASE_HEIGHT + theme.spacing * CONTROL_HEIGHT_PER_SPACING}px`,
    '--color-success': theme.successColor,
    '--color-warning': theme.warningColor,
    '--color-error': theme.errorColor,
    '--color-info': theme.infoColor,
    // Tailwind sizes are rem-based, so the base font size scales the whole interface.
    'font-size': `${theme.fontSize}px`,
  };
};

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
  readonly active = this.current.asReadonly();
  readonly logoUrl = computed(() => this.current()?.logoUrl ?? null);

  private defaultFavicon: string | null = null;
  private loadedFor: string | null = null;
  private appliedStyles: readonly string[] = [];

  constructor() {
    // Reload whenever the signed-in organization changes; clear on sign-out.
    // untracked: only the auth signals should re-run this, not anything read while loading.
    effect(() => {
      const tenantId = this.auth.isAuthenticated() ? this.auth.tenantId() : null;
      untracked(() => this.syncTenant(tenantId));
    });
  }

  async load(): Promise<void> {
    const tenantId = this.loadedFor;
    try {
      const theme = await firstValueFrom(this.api.active());
      // Ignore a response that arrives after sign-out or an organization switch.
      if (this.loadedFor === tenantId) this.apply(theme);
    } catch {
      // Branding is cosmetic: on failure the app keeps its built-in look.
    }
  }

  apply(theme: Theme): void {
    if (!isHexColor(theme.primaryColor)) return;

    const root = this.doc.documentElement.style;
    const styles = themeStyles(theme);
    for (const [name, value] of Object.entries(styles)) root.setProperty(name, value);
    this.appliedStyles = Object.keys(styles);

    ensureFontLoaded(this.doc, theme.fontFamily);
    this.setFavicon(theme.faviconUrl);
    this.appearance.applyOrganizationDefault(theme.mode);
    this.current.set(theme);
  }

  private syncTenant(tenantId: string | null): void {
    if (tenantId === this.loadedFor) return;
    this.loadedFor = tenantId;
    if (tenantId) void this.load();
    else this.reset();
  }

  private reset(): void {
    const root = this.doc.documentElement.style;
    for (const name of this.appliedStyles) root.removeProperty(name);
    this.appliedStyles = [];
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