import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  model,
  numberAttribute,
  output,
} from '@angular/core';

export type PageItem = { type: 'page'; value: number } | { type: 'ellipsis'; key: string };

export interface PageChangeEvent {
  page: number;
  pageSize: number;
  /** 0-based, inclusive */
  startIndex: number;
  /** 0-based, exclusive */
  endIndex: number;
}

/**
 * Shared, signal-based pagination used by every paged list in the app.
 *
 * <app-pagination
 *   [totalItems]="total()"
 *   [(page)]="page"
 *   [(pageSize)]="pageSize"
 *   [pageSizeOptions]="[10, 25, 50]"
 *   entityLabel="files"
 *   (paginate)="load($event)" />
 *
 * `page` / `pageSize` are models for client-side lists. Store-driven (server-side)
 * lists should bind them one-way and react to `(paginate)`, which fires exactly
 * once per user action — a page-size change resets to page 1 in the same event.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-pagination',
    role: 'navigation',
    '[attr.aria-label]': 'ariaLabel()',
  },
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  readonly totalItems = input(0, { transform: numberAttribute });
  /** 1-based, two-way bindable. */
  readonly page = model(1);
  readonly pageSize = model(10);
  readonly pageSizeOptions = input<readonly number[]>([]);
  /** Pages shown on each side of the current page. */
  readonly siblingCount = input(1, { transform: numberAttribute });
  /** Pages always shown at each edge. */
  readonly boundaryCount = input(1, { transform: numberAttribute });
  readonly showFirstLast = input(false, { transform: booleanAttribute });
  readonly showSummary = input(true, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly entityLabel = input('');
  readonly ariaLabel = input('Pagination');

  /** Fires after any user-driven page or page-size change, with the resulting window. */
  readonly paginate = output<PageChangeEvent>();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / Math.max(1, this.pageSize()))),
  );

  /** Page clamped into range — always safe to render. */
  readonly currentPage = computed(() =>
    Math.min(Math.max(1, Math.trunc(this.page() || 1)), this.totalPages()),
  );

  readonly isFirst = computed(() => this.currentPage() <= 1);
  readonly isLast = computed(() => this.currentPage() >= this.totalPages());

  readonly startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());
  readonly endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize(), this.totalItems()),
  );
  readonly rangeStart = computed(() => (this.totalItems() ? this.startIndex() + 1 : 0));
  readonly rangeEnd = computed(() => this.endIndex());

  readonly pages = computed<PageItem[]>(() =>
    buildPageItems(
      this.currentPage(),
      this.totalPages(),
      this.siblingCount(),
      this.boundaryCount(),
    ),
  );

  goTo(target: number): void {
    if (this.disabled()) return;
    const next = Math.min(Math.max(1, target), this.totalPages());
    if (next === this.currentPage()) return;
    this.page.set(next);
    this.emit();
  }

  next(): void {
    this.goTo(this.currentPage() + 1);
  }

  prev(): void {
    this.goTo(this.currentPage() - 1);
  }

  setPageSize(size: number): void {
    if (this.disabled() || !size || size === this.pageSize()) return;
    this.pageSize.set(size);
    if (this.page() !== 1) this.page.set(1);
    this.emit();
  }

  private emit(): void {
    this.paginate.emit({
      page: this.currentPage(),
      pageSize: this.pageSize(),
      startIndex: this.startIndex(),
      endIndex: this.endIndex(),
    });
  }
}

/** Pure helper: 1 … 4 5 [6] 7 8 … 20 */
export function buildPageItems(
  current: number,
  total: number,
  siblings = 1,
  boundaries = 1,
): PageItem[] {
  const range = (a: number, b: number): number[] =>
    Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const toPage = (value: number): PageItem => ({ type: 'page', value });

  // Everything fits → no ellipsis.
  const slots = boundaries * 2 + siblings * 2 + 3;
  if (total <= slots) return range(1, total).map(toPage);

  const sibStart = Math.max(
    Math.min(current - siblings, total - boundaries - siblings * 2 - 1),
    boundaries + 2,
  );
  const sibEnd = Math.min(
    Math.max(current + siblings, boundaries + siblings * 2 + 2),
    total - boundaries - 1,
  );

  const items: PageItem[] = range(1, boundaries).map(toPage);

  items.push(
    sibStart > boundaries + 2 ? { type: 'ellipsis', key: 'start' } : toPage(boundaries + 1),
  );
  items.push(...range(sibStart, sibEnd).map(toPage));
  items.push(
    sibEnd < total - boundaries - 1 ? { type: 'ellipsis', key: 'end' } : toPage(total - boundaries),
  );
  items.push(...range(total - boundaries + 1, total).map(toPage));

  return items;
}
