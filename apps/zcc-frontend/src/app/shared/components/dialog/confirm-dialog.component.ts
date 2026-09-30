import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DialogShellComponent } from './dialog-shell.component';
import { injectDialogData, injectDialogRef } from './dialog.inject';
import { ConfirmDialogData } from './dialog.types';

@Component({
  selector: 'app-confirm-dialog',
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-shell [title]="data.title" [showClose]="false" [closeResult]="false">
      <p class="app-confirm__message">{{ data.message }}</p>

      @if (!data.hideCancel) {
        <button
          dialogActions
          type="button"
          class="app-dialog-btn app-dialog-btn--ghost"
          [attr.cdkFocusInitial]="isDestructive ? '' : null"
          (click)="ref.close(false)"
        >
          {{ data.cancelText ?? 'Cancel' }}
        </button>
      }

      <button
        dialogActions
        type="button"
        class="app-dialog-btn"
        [class]="'app-dialog-btn app-dialog-btn--' + (data.variant ?? 'primary')"
        [attr.cdkFocusInitial]="isDestructive ? null : ''"
        (click)="ref.close(true)"
      >
        {{ data.confirmText ?? 'Confirm' }}
      </button>
    </app-dialog-shell>
  `,
  styles: `
    .app-confirm__message {
      margin: 0;
      white-space: pre-line;
    }
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = injectDialogData<ConfirmDialogData>();
  protected readonly ref = injectDialogRef<boolean>();

  /** For destructive actions, focus lands on Cancel so Enter can't delete by accident. */
  protected readonly isDestructive = this.data.variant === 'danger' && !this.data.hideCancel;
}
