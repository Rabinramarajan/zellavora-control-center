import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthStore } from '../auth/auth.store';
import { AnalyticsApiService } from '../api/analytics.api';

const VISITOR_KEY = 'zcc.analytics.visitor';
const SESSION_KEY = 'zcc.analytics.session';
/** A session ends after 30 minutes without a page view (the common analytics convention). */
const SESSION_IDLE_MS = 30 * 60 * 1000;

interface StoredSession {
  id: string;
  lastSeen: number;
}

const read = (storage: () => Storage, key: string): string | null => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const write = (storage: () => Storage, key: string, value: string): void => {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage blocked (private mode, quota): tracking continues with in-memory ids.
  }
};

/**
 * Reports a page view to the analytics API after every completed navigation inside the
 * signed-in app. Fire-and-forget: failures are swallowed and never reach the user.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsTrackerService {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly api = inject(AnalyticsApiService);

  private started = false;
  private lastPath: string | null = null;
  private memoryVisitor: string | null = null;
  private memorySession: StoredSession | null = null;

  public start(): void {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.onNavigation(e.urlAfterRedirects || e.url));
  }

  private onNavigation(url: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    if (!this.shouldTrack(path)) return;
    // Query-param changes on the same screen (filters, tabs) are not new page views.
    if (path === this.lastPath) return;
    this.lastPath = path;

    const { id: sessionId, isNew } = this.session();
    this.api
      .track({
        sessionId,
        visitorId: this.visitor(),
        eventType: 'pageview',
        path,
        title: document.title.slice(0, 200) || undefined,
        referrer: isNew ? this.externalReferrer() : undefined,
      })
      .subscribe({ error: () => undefined });
  }

  private shouldTrack(path: string): boolean {
    if (!this.auth.isAuthenticated() || !this.auth.tenant()) return false;
    if (path === '/auth' || path.startsWith('/auth/')) return false;
    return navigator.doNotTrack !== '1';
  }

  private visitor(): string {
    const stored = read(() => localStorage, VISITOR_KEY) ?? this.memoryVisitor;
    if (stored) return stored;
    const id = crypto.randomUUID();
    this.memoryVisitor = id;
    write(() => localStorage, VISITOR_KEY, id);
    return id;
  }

  private session(): { id: string; isNew: boolean } {
    const now = Date.now();
    let current = this.memorySession;
    const raw = read(() => sessionStorage, SESSION_KEY);
    if (raw) {
      try {
        current = JSON.parse(raw) as StoredSession;
      } catch {
        current = null;
      }
    }
    const isNew = !current || now - current.lastSeen > SESSION_IDLE_MS;
    const next: StoredSession = { id: isNew ? crypto.randomUUID() : current!.id, lastSeen: now };
    this.memorySession = next;
    write(() => sessionStorage, SESSION_KEY, JSON.stringify(next));
    return { id: next.id, isNew };
  }

  /** Only another site counts as a referrer; links within the app are navigation. */
  private externalReferrer(): string | undefined {
    try {
      const ref = document.referrer;
      if (!ref || new URL(ref).origin === location.origin) return undefined;
      return ref.slice(0, 512);
    } catch {
      return undefined;
    }
  }
}
