import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * EmptyStateComponent — centered icon + heading for list/panel empty states.
 */
@Component({
  selector: 'zcc-empty-state',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div
        class="flex size-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5"
      >
        <i [class]="icon()" class="text-2xl text-gray-400" aria-hidden="true"></i>
      </div>
      <h3 class="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {{ title() }}
      </h3>
      @if (message()) {
        <p class="max-w-sm text-sm text-gray-400 dark:text-gray-500">{{ message() }}</p>
      }
      <ng-content></ng-content>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('pi pi-inbox');
  readonly title = input.required<string>();
  readonly message = input('');
}
