import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AuthAlertTone = 'error' | 'success' | 'info' | 'warning';

const ICONS: Record<AuthAlertTone, string> = {
  error: 'M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  warning: 'M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  success: 'M9 12.5l2 2 4-4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  info: 'M12 11v5m0-8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

const LABELS: Record<AuthAlertTone, string> = {
  error: 'Error',
  warning: 'Warning',
  success: 'Success',
  info: 'Note',
};

/**
 * Inline status message. Tone is conveyed by icon + visually hidden label as
 * well as color; errors are announced assertively, everything else politely.
 */
@Component({
  selector: 'app-auth-alert',
  standalone: true,
  template: `
    <div
      class="auth-alert"
      [class]="'auth-alert auth-alert--' + tone()"
      [attr.role]="tone() === 'error' ? 'alert' : 'status'"
    >
      <svg class="auth-alert__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path [attr.d]="icon()" />
      </svg>
      <div class="auth-alert__body">
        <span class="sr-only">{{ srLabel() }}: </span>
        @if (heading()) {
          <p class="auth-alert__heading">{{ heading() }}</p>
        }
        <div class="auth-alert__text"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .auth-alert {
      display: flex;
      gap: 0.65rem;
      padding: 0.75rem 0.9rem;
      border-radius: 0.8rem;
      border: 1px solid;
      font-size: 0.84rem;
      line-height: 1.5;
    }
    .auth-alert__icon { flex-shrink: 0; margin-top: 0.1rem; }
    .auth-alert__body { min-width: 0; }
    .auth-alert__heading { font-weight: 700; color: var(--auth-text-strong); margin-bottom: 0.15rem; }
    .auth-alert__text { color: var(--auth-text); }
    .auth-alert--error { background: rgba(248, 113, 113, 0.08); border-color: rgba(248, 113, 113, 0.3); color: var(--auth-danger-text); }
    .auth-alert--success { background: rgba(52, 211, 153, 0.08); border-color: rgba(52, 211, 153, 0.28); color: var(--auth-success-text); }
    .auth-alert--info { background: rgba(125, 211, 252, 0.07); border-color: rgba(125, 211, 252, 0.25); color: var(--auth-info); }
    .auth-alert--warning { background: rgba(251, 191, 36, 0.08); border-color: rgba(251, 191, 36, 0.3); color: var(--auth-warning); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthAlertComponent {
  readonly tone = input<AuthAlertTone>('info');
  readonly heading = input('');

  protected readonly icon = computed(() => ICONS[this.tone()]);
  protected readonly srLabel = computed(() => LABELS[this.tone()]);
}
