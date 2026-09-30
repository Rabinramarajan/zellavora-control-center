import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

import { APP_DIALOG_TITLE_ID } from './dialog.types';

let localId = 0;

/**
 * Common dialog chrome: title, optional subtitle, close button,
 * scrollable body and an actions footer.
 *
 *   <app-dialog-shell title="Edit user">
 *     ...body...
 *     <button dialogActions>Save</button>
 *   </app-dialog-shell>
 */
@Component({
  selector: 'app-dialog-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-dialog',
    '[attr.aria-busy]': 'busy() || null',
  },
  template: `
    <header class="app-dialog__header">
      <div class="app-dialog__heading">
        <h2 class="app-dialog__title" [id]="titleId">
          {{ title() }}<ng-content select="[dialogTitle]" />
        </h2>
        @if (subtitle()) {
          <p class="app-dialog__subtitle">{{ subtitle() }}</p>
        }
      </div>

      @if (showClose()) {
        <button
          type="button"
          class="app-dialog__close"
          aria-label="Close dialog"
          [disabled]="busy()"
          (click)="close()"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </button>
      }
    </header>

    @if (busy()) {
      <div class="app-dialog__progress" role="progressbar" aria-label="Loading"></div>
    }

    <div class="app-dialog__body">
      <ng-content />
    </div>

    <footer
      class="app-dialog__actions"
      [class.app-dialog__actions--start]="actionsAlign() === 'start'"
      [class.app-dialog__actions--between]="actionsAlign() === 'between'"
    >
      <ng-content select="[dialogActions]" />
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: inherit;
      max-height: inherit;
      color: var(--app-dialog-on-surface);
    }

    .app-dialog__header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 20px 24px 12px;
      flex: 0 0 auto;
    }

    .app-dialog__heading {
      flex: 1 1 auto;
      min-width: 0;
    }

    .app-dialog__title {
      margin: 0;
      font: var(--mat-sys-title-large, 500 1.25rem/1.6 system-ui, sans-serif);
      overflow-wrap: anywhere;
    }

    .app-dialog__subtitle {
      margin: 4px 0 0;
      font: var(--mat-sys-body-medium, 400 0.875rem/1.4 system-ui, sans-serif);
      color: var(--app-dialog-on-surface-variant);
    }

    .app-dialog__close {
      flex: 0 0 auto;
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      margin: -8px -12px 0 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--app-dialog-on-surface-variant);
      cursor: pointer;

      &:hover:not(:disabled) {
        background: var(--app-dialog-hover);
      }
      &:focus-visible {
        outline: 2px solid var(--app-dialog-primary);
        outline-offset: 2px;
      }
      &:disabled {
        opacity: 0.4;
        cursor: default;
      }
    }

    .app-dialog__progress {
      position: relative;
      height: 3px;
      overflow: hidden;
      background: var(--app-dialog-hover);

      &::after {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 40%;
        background: var(--app-dialog-primary);
        animation: app-dialog-progress 1.1s ease-in-out infinite;
      }
    }

    .app-dialog__body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding: 8px 24px 16px;
      font: var(--mat-sys-body-medium, 400 0.875rem/1.5 system-ui, sans-serif);
      color: var(--app-dialog-on-surface-variant);
    }

    .app-dialog__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 12px 24px 20px;
      flex: 0 0 auto;

      &:empty {
        display: none;
      }
    }

    .app-dialog__actions--start {
      justify-content: flex-start;
    }
    .app-dialog__actions--between {
      justify-content: space-between;
    }

    @keyframes app-dialog-progress {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .app-dialog__progress::after {
        animation-duration: 3s;
      }
    }
  `,
})
export class DialogShellComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>();
  readonly showClose = input(true);
  /** Shows a progress bar and disables the close button. */
  readonly busy = input(false);
  /** Value passed to `close()` when the X button is used. */
  readonly closeResult = input<unknown>(undefined);
  readonly actionsAlign = input<'end' | 'start' | 'between'>('end');

  protected readonly titleId =
    inject(APP_DIALOG_TITLE_ID, { optional: true }) ?? `app-dialog-title-local-${localId++}`;

  readonly #ref = inject(DialogRef, { optional: true });

  protected close(): void {
    this.#ref?.close(this.closeResult());
  }
}
