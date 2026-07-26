/**
 * SessionActivityService — idle-timeout enforcement.
 *
 * Listens to mouse/keyboard/scroll events and tracks "last activity".
 * If the user is idle for `idleTimeoutMs` (default 30 min), the session is
 * auto-terminated. Active requests are NOT cancelled; the user is simply
 * logged out so the next interaction lands on /auth/login.
 *
 * Also pings /auth/refresh on user-visible activity to keep the sliding-
 * window session alive.
 */
import { Injectable, inject, OnDestroy } from '@angular/core';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

const DEFAULT_IDLE_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'] as const;

@Injectable({ providedIn: 'root' })
export class SessionActivityService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly store = inject(AuthStore);
  private idleTimeoutMs = DEFAULT_IDLE_MS;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private listenersBound = false;

  /** Start tracking. Idempotent. */
  start(idleTimeoutMs: number = DEFAULT_IDLE_MS): void {
    this.idleTimeoutMs = idleTimeoutMs;
    if (this.listenersBound) return;
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, this.onActivity, { passive: true }));
    this.listenersBound = true;
    this.resetIdleTimer();
  }

  stop(): void {
    if (!this.listenersBound) return;
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, this.onActivity));
    this.listenersBound = false;
    if (this.idleTimer) clearTimeout(this.idleTimer);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private onActivity = (): void => {
    if (!this.store.isAuthenticated()) return;
    this.resetIdleTimer();
  };

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.onIdle(), this.idleTimeoutMs);
  }

  private onIdle(): void {
    if (!this.store.isAuthenticated()) return;
    // Soft-logout: don't call /logout (we want a clean silent end-of-session).
    this.auth.logout(false).subscribe();
  }
}
