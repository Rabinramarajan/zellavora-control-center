import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AuthAlertTone = 'error' | 'success' | 'info' | 'warning';

const ICONS: Record<AuthAlertTone, string> = {
  error:
    'M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  warning:
    'M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
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
  templateUrl: './auth-alert.component.html',
  styleUrl: './auth-alert.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthAlertComponent {
  readonly tone = input<AuthAlertTone>('info');
  readonly heading = input('');

  protected readonly icon = computed(() => ICONS[this.tone()]);
  protected readonly srLabel = computed(() => LABELS[this.tone()]);
}
