import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * PaginationBarComponent — prev/next + page indicator + total count.
 * Emits `pageChange` when the user navigates.
 */
@Component({
  selector: 'zcc-pagination-bar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between gap-4 px-1 py-3">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ totalLabel() }}
      </p>

      <div class="flex items-center gap-2">
        <button
          type="button"
          [disabled]="!canPrev()"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5"
          (click)="prev()"
        >
          <i class="pi pi-chevron-left text-xs" aria-hidden="true"></i>
          Prev
        </button>

        <span class="px-2 text-sm text-gray-600 dark:text-gray-300 tabular-nums">
          Page {{ page() }} of {{ totalPages() }}
        </span>

        <button
          type="button"
          [disabled]="!canNext()"
          class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/5"
          (click)="next()"
        >
          Next
          <i class="pi pi-chevron-right text-xs" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
})
export class PaginationBarComponent {
  readonly page = input<number>(1);
  readonly pageSize = input<number>(20);
  readonly total = input<number>(0);

  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly canPrev = computed(() => this.page() > 1);
  readonly canNext = computed(() => this.page() < this.totalPages());
  readonly totalLabel = computed(() => `${this.total()} item${this.total() === 1 ? '' : 's'}`);

  prev(): void {
    if (this.canPrev()) this.pageChange.emit(this.page() - 1);
  }

  next(): void {
    if (this.canNext()) this.pageChange.emit(this.page() + 1);
  }
}
