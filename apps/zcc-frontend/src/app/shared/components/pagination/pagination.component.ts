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
  template: `
    @if (showSummary()) {
      <span class="pg-summary" aria-live="polite">
        @if (totalItems() > 0) {
          Showing <strong>{{ rangeStart() }}–{{ rangeEnd() }}</strong> of
          <strong>{{ totalItems() }}</strong> {{ entityLabel() }}
        } @else {
          No {{ entityLabel() || 'results' }}
        }
      </span>
    }

    <div class="pg-controls">
      <ul class="pg-list">
        @if (showFirstLast()) {
          <li>
            <button type="button" class="pg-btn" aria-label="First page"
                    [disabled]="disabled() || isFirst()" (click)="goTo(1)">
              <i class="pi pi-angle-double-left" aria-hidden="true"></i>
            </button>
          </li>
        }
        <li>
          <button type="button" class="pg-btn" aria-label="Previous page"
                  [disabled]="disabled() || isFirst()" (click)="prev()">
            <i class="pi pi-angle-left" aria-hidden="true"></i>
          </button>
        </li>

        @for (item of pages(); track item.type === 'page' ? item.value : item.key) {
          <li>
            @if (item.type === 'page') {
              <button type="button" class="pg-btn"
                      [class.active]="item.value === currentPage()"
                      [attr.aria-current]="item.value === currentPage() ? 'page' : null"
                      [attr.aria-label]="'Page ' + item.value"
                      [disabled]="disabled()"
                      (click)="goTo(item.value)">{{ item.value }}</button>
            } @else {
              <span class="pg-ellipsis" aria-hidden="true">…</span>
            }
          </li>
        }

        <li>
          <button type="button" class="pg-btn" aria-label="Next page"
                  [disabled]="disabled() || isLast()" (click)="next()">
            <i class="pi pi-angle-right" aria-hidden="true"></i>
          </button>
        </li>
        @if (showFirstLast()) {
          <li>
            <button type="button" class="pg-btn" aria-label="Last page"
                    [disabled]="disabled() || isLast()" (click)="goTo(totalPages())">
              <i class="pi pi-angle-double-right" aria-hidden="true"></i>
            </button>
          </li>
        }
      </ul>

      @if (pageSizeOptions().length > 1) {
        <label class="pg-size">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            [disabled]="disabled()"
            (change)="setPageSize(+$any($event.target).value)"
          >
            @for (size of pageSizeOptions(); track size) {
              <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
            }
          </select>
        </label>
      }
    </div>
  `,
  styles: `
    :host {
      --pg-gap: 0.25rem;
      --pg-size: 2.25rem;
      --pg-radius: 0.5rem;
      --pg-border: rgba(255, 255, 255, 0.08);
      --pg-fg: #e2e8f0;
      --pg-muted: #94a3b8;
      --pg-hover: rgba(255, 255, 255, 0.06);
      --pg-accent: #8b5cf6;
      --pg-accent-2: #6366f1;
      --pg-active-fg: #fff;
      --pg-select-bg: #120d2e;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1rem;
      font: inherit;
      color: var(--pg-muted);
    }
    :host-context(html.light) {
      --pg-border: #e2e8f0;
      --pg-fg: #0f172a;
      --pg-muted: #475569;
      --pg-hover: #f1f5f9;
      --pg-select-bg: #ffffff;
    }
    .pg-summary { font-size: 0.8125rem; }
    .pg-summary strong { font-weight: 600; color: var(--pg-fg); }
    .pg-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
    .pg-list { display: flex; flex-wrap: wrap; gap: var(--pg-gap); list-style: none; margin: 0; padding: 0; }
    .pg-btn {
      display: inline-grid; place-items: center;
      min-width: var(--pg-size); height: var(--pg-size); padding: 0 0.5rem;
      border: 1px solid transparent; border-radius: var(--pg-radius);
      background: transparent; color: inherit; cursor: pointer;
      font: inherit; font-size: 0.8125rem; font-weight: 600;
      font-variant-numeric: tabular-nums;
      transition: background 0.18s ease, color 0.18s ease;
    }
    .pg-btn .pi { font-size: 0.75rem; }
    .pg-btn:hover:not(:disabled):not(.active) { background: var(--pg-hover); color: var(--pg-fg); }
    .pg-btn:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 2px; }
    .pg-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .pg-btn.active {
      background: linear-gradient(135deg, var(--pg-accent), var(--pg-accent-2));
      color: var(--pg-active-fg);
    }
    .pg-ellipsis {
      display: inline-grid; place-items: center;
      min-width: var(--pg-size); height: var(--pg-size);
    }
    .pg-size { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.8125rem; }
    .pg-size select {
      height: var(--pg-size); padding: 0 0.5rem;
      border: 1px solid var(--pg-border); border-radius: var(--pg-radius);
      background: var(--pg-select-bg); color: var(--pg-fg); font: inherit; cursor: pointer;
    }
    .pg-size select:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 2px; }
    @media (pointer: coarse) {
      :host { --pg-size: 2.75rem; }
    }
    @media (max-width: 639px) {
      :host { justify-content: center; }
      .pg-controls { justify-content: center; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pg-btn { transition: none; }
    }
  `,
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
