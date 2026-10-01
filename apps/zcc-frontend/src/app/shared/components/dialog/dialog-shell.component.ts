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
  templateUrl: './dialog-shell.component.html',
  styleUrl: './dialog-shell.component.scss',
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
