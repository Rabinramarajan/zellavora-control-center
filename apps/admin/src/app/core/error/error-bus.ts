/**
 * ErrorBus — application-wide event channel for non-fatal errors.
 *
 * Anything that "should show a toast" pushes here. The toast component
 * (ErrorToastComponent, in @shared/components) subscribes and renders.
 *
 * Use cases:
 *   - 401/403/423/429 surfaced from interceptors
 *   - Client-side validation errors that should be visible globally
 *   - Network outages
 */
import { Injectable, signal } from '@angular/core';

export type ErrorKind = 'auth' | 'warning' | 'error' | 'info';

export interface ErrorEvent {
  id: number;
  kind: ErrorKind;
  message: string;
  /** Auto-dismiss after this many ms; 0 = sticky. Default 5000. */
  ttl?: number;
  /** Optional action button. */
  action?: { label: string; run: () => void };
  createdAt: number;
}

@Injectable({ providedIn: 'root' })
export class ErrorBus {
  private next = 1;
  private readonly events = signal<ErrorEvent[]>([]);
  readonly all = this.events.asReadonly();

  push(input: Omit<ErrorEvent, 'id' | 'createdAt'>): number {
    const id = this.next++;
    const evt: ErrorEvent = { id, createdAt: Date.now(), ttl: 5000, ...input };
    this.events.update((list) => [...list, evt]);
    if (evt.ttl && evt.ttl > 0) {
      setTimeout(() => this.dismiss(id), evt.ttl);
    }
    return id;
  }

  dismiss(id: number): void {
    this.events.update((list) => list.filter((e) => e.id !== id));
  }

  clear(): void {
    this.events.set([]);
  }
}
