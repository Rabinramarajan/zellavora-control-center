import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

export type DialogTone = 'default' | 'danger' | 'warning';

/**
 * ConfirmDialogComponent — lightweight modal for destructive/confirm actions.
 * Rendered conditionally by the parent; emits `confirm` / `cancel`.
 */
@Component({
  selector: 'zcc-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        (click)="cancel.emit()"
      ></div>
      <div
        class="relative w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl"
      >
        <div class="flex items-start gap-4">
          <div
            [class]="iconClasses()"
            class="flex size-10 shrink-0 items-center justify-center rounded-full"
          >
            <i [class]="icon()" class="text-lg" aria-hidden="true"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ title() }}
            </h3>
            @if (message()) {
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ message() }}</p>
            }
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            (click)="cancel.emit()"
          >
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            [class]="confirmClasses()"
            class="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
            (click)="confirm.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
    </div>
  `,
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
