import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Must match the key read by the pre-bootstrap script in index.html. */
const THEME_STORAGE_KEY = 'zcc-theme';
const DEFAULT_PREFERENCE: ThemePreference = 'dark';

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f8fafc',
  dark: '#03020c',
};

const isThemePreference = (value: string | null): value is ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly mediaQuery = this.window?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  private readonly _preference = signal<ThemePreference>(
    this.readStoredPreference() ?? DEFAULT_PREFERENCE,
  );
  /** Read-only: change it through setPreference() so it is persisted. */
  readonly preference = this._preference.asReadonly();

  /** Pages with a fixed brand look (the sign-in screens) pin a theme regardless of preference. */
  readonly forcedTheme = signal<ResolvedTheme | null>(null);

  private readonly systemPrefersDark = signal(this.mediaQuery?.matches ?? true);

  readonly theme = computed<ResolvedTheme>(() => {
    const forced = this.forcedTheme();
    if (forced) {
      return forced;
    }
    const preference = this._preference();
    if (preference === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
  });

  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    if (this.mediaQuery) {
      const mediaQuery = this.mediaQuery;
      const onChange = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
      mediaQuery.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => mediaQuery.removeEventListener('change', onChange));
    }

    effect(() => this.apply(this.theme()));
  }

  setPreference(preference: ThemePreference): void {
    this._preference.set(preference);
    try {
      this.window?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the choice still applies for this session.
    }
  }

  /**
   * The organization theme's default appearance; applied only to people who have never
   * picked light or dark themselves, and never saved as their own choice.
   */
  applyOrganizationDefault(mode: ResolvedTheme): void {
    if (!this.readStoredPreference()) {
      this._preference.set(mode);
    }
  }

  toggle(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }

  private apply(theme: ResolvedTheme): void {
    const root = this.document.documentElement;

    // Suppress per-element transitions so the whole UI swaps in one frame instead of fading piecemeal.
    // Only when a window exists: without one the frame callback never runs and the class would stick.
    if (this.window) {
      root.classList.add('theme-switching');
      this.window.requestAnimationFrame(() => root.classList.remove('theme-switching'));
    }

    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
  }

  /** The saved preference, or null when nothing valid is stored (or storage is blocked). */
  private readStoredPreference(): ThemePreference | null {
    try {
      const stored = this.window?.localStorage.getItem(THEME_STORAGE_KEY) ?? null;
      return isThemePreference(stored) ? stored : null;
    } catch {
      return null;
    }
  }
}