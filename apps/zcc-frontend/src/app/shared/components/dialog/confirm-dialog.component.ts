import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DialogShellComponent } from './dialog-shell.component';
import { injectDialogData, injectDialogRef } from './dialog.inject';
import { ConfirmDialogData } from './dialog.types';

@Component({
  selector: 'app-confirm-dialog',
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  protected readonly data = injectDialogData<ConfirmDialogData>();
  protected readonly ref = injectDialogRef<boolean>();

  /** For destructive actions, focus lands on Cancel so Enter can't delete by accident. */
  protected readonly isDestructive = this.data.variant === 'danger' && !this.data.hideCancel;
}
