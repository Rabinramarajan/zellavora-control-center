import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';

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
  imports: [FormInputControl, SelectControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss',
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

  /** Each filter leads with an "All" entry that clears it. */
  readonly selectFilters = computed(() =>
    this.filters().map((filter) => {
      const allLabel = filter.allLabel ?? 'All';
      const options: SelectControlOption[] = [{ value: '', label: allLabel }, ...filter.options];
      return { key: filter.key, label: filter.label, allLabel, options };
    })
  );

  readonly canReset = computed(
    () => this.query() !== '' || Object.keys(this.selected()).length > 0
  );

  onSearchInput(value: string): void {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => this.search.emit(value), 300);
  }

  onFilterChange(key: string, value: string): void {
    this.filtersChange.emit({ ...this.selected(), [key]: value });
  }

  reset(): void {
    this.resetClicked.emit();
  }
}
