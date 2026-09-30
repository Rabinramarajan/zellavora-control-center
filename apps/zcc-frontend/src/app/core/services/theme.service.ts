import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Must match the key read by the pre-bootstrap script in index.html. */
export const THEME_STORAGE_KEY = 'zcc-theme';

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f8fafc',
  dark: '#03020c',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly mediaQuery = this.window?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  readonly preference = signal<ThemePreference>(this.readStoredPreference());
  /** Pages with a fixed brand look (the sign-in screens) pin a theme regardless of preference. */
  readonly forcedTheme = signal<ResolvedTheme | null>(null);
  private readonly systemPrefersDark = signal(this.mediaQuery?.matches ?? true);

  readonly theme = computed<ResolvedTheme>(() => {
    const forced = this.forcedTheme();
    if (forced) {
      return forced;
    }
    const preference = this.preference();
    if (preference === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }
    return preference;
  });

  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    if (this.mediaQuery) {
      const onChange = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
      this.mediaQuery.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => this.mediaQuery?.removeEventListener('change', onChange));
    }

    effect(() => this.apply(this.theme()));
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    try {
      this.window?.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the choice still applies for this session.
    }
  }

  toggle(): void {
    this.setPreference(this.isDark() ? 'light' : 'dark');
  }

  private apply(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    // Suppress per-element transitions so the whole UI swaps in one frame instead of fading piecemeal.
    root.classList.add('theme-switching');
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLOR[theme]);
    this.window?.requestAnimationFrame(() => root.classList.remove('theme-switching'));
  }

  private readStoredPreference(): ThemePreference {
    try {
      const stored = this.window?.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fall through to the default when storage is inaccessible.
    }
    return 'dark';
  }
}
