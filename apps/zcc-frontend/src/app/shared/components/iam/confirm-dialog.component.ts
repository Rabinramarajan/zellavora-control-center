import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type DialogTone = 'default' | 'danger' | 'warning';

/**
 * ConfirmDialogComponent — lightweight modal for destructive/confirm actions.
 * Rendered conditionally by the parent; emits `confirm` / `cancel`.
 */
@Component({
  selector: 'zcc-confirm-dialog',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly tone = input<DialogTone>('danger');
  readonly icon = input('pi pi-exclamation-triangle');

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  readonly iconClasses = () =>
    this.tone() === 'danger'
      ? 'bg-red-500/10 text-red-500'
      : this.tone() === 'warning'
        ? 'bg-amber-500/10 text-amber-500'
        : 'bg-indigo-500/10 text-indigo-500';

  readonly confirmClasses = () =>
    this.tone() === 'danger'
      ? 'bg-red-500 hover:bg-red-600'
      : this.tone() === 'warning'
        ? 'bg-amber-500 hover:bg-amber-600'
        : 'bg-indigo-500 hover:bg-indigo-600';
}
