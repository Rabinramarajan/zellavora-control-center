import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  model,
} from '@angular/core';

export interface FilterChipOption<T> {
  value: T;
  label: string;
  /** `null` renders a pending placeholder; omit to hide the count. */
  count?: number | null;
}

/**
 * Signal-based single-select chip group for quick list filters.
 *
 * <app-filter-chips
 *   ariaLabel="Requests by status"
 *   allLabel="All Requests"
 *   [allCount]="totalCount()"
 *   [options]="statusChips()"
 *   [selected]="activeStatus()"
 *   (selectedChange)="quickStatus($event)" />
 *
 * `selected` is `null` for "All" and `undefined` when the list is filtered in a way
 * no chip represents (e.g. several statuses picked in an advanced filter), so nothing
 * is highlighted. Clicking the active chip clears back to `null`.
 */
@Component({
  selector: 'app-filter-chips',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex flex-wrap gap-2',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
  imports: [NgTemplateOutlet],
  templateUrl: './filter-chips.component.html',
})
export class FilterChipsComponent<T> {
  readonly options = input.required<readonly FilterChipOption<T>[]>();
  readonly selected = model<T | null | undefined>(null);
  readonly ariaLabel = input('Filters');
  readonly showAll = input(true, { transform: booleanAttribute });
  readonly allLabel = input('All');
  /** `null` renders a pending placeholder; `undefined` hides the count. */
  readonly allCount = input<number | null | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly allActive = computed(() => this.selected() === null);

  protected isActive(value: T): boolean {
    return this.selected() === value;
  }

  protected select(value: T | null): void {
    if (this.disabled()) return;
    this.selected.set(value !== null && this.isActive(value) ? null : value);
  }
}
