import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDescriptor {
  key: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
}

/**
 * FilterBarComponent — search input + optional select filters rendered inline.
 * Emits `search` (debounced) and `filtersChange` with the current selections.
 */
@Component({
  selector: 'zcc-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <div class="relative min-w-56 flex-1">
        <i
          class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
          aria-hidden="true"
        ></i>
        <input
          type="text"
          [value]="query()"
          [placeholder]="searchPlaceholder()"
          class="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white/10 dark:bg-black/20 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          (input)="onSearchInput($event)"
        />
      </div>

      @for (filter of filters(); track filter.key) {
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-gray-600 dark:text-gray-300">
            {{ filter.label }}
          </label>
          <select
            [value]="selected()[filter.key] ?? ''"
            (change)="onFilterChange(filter.key, $event)"
            class="rounded-lg border border-gray-300 dark:border-white/10 bg-white/10 dark:bg-black/20 px-2.5 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">{{ filter.allLabel ?? 'All' }}</option>
            @for (option of filter.options; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>
      }

      @if (canReset()) {
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          (click)="reset()"
        >
          <i class="pi pi-refresh mr-1 text-xs" aria-hidden="true"></i>
          Reset
        </button>
      }
    </div>
  `,
})
export class FilterBarComponent {
  readonly query = input('');
  readonly searchPlaceholder = input('Search…');
  readonly filters = input<FilterDescriptor[]>([]);
  readonly selected = input<Record<string, string>>({});

  readonly search = output<string>();
  readonly filtersChange = output<Record<string, string>>();
  readonly resetClicked = output<void>();

  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly canReset = computed(
    () => this.query() !== '' || Object.keys(this.selected()).length > 0
  );

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => this.search.emit(value), 300);
  }

  onFilterChange(key: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.filtersChange.emit({ ...this.selected(), [key]: value });
  }

  reset(): void {
    this.resetClicked.emit();
  }
}
