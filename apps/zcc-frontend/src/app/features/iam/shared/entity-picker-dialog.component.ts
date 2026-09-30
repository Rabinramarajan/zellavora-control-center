import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DialogShellComponent, injectDialogData, injectDialogRef } from '@shared/components/dialog';
import { errorMessage } from './iam-feedback.service';
import { IAM_INPUT } from './iam-page-header.component';

export interface PickerOption {
  id: string;
  label: string;
  sublabel?: string | null;
  /** Nesting level for tree sources (child groups); 0 = top level. */
  depth?: number;
  /** Small status tag, e.g. "Inactive" or "System". */
  badge?: string | null;
}

export interface EntityPickerData {
  title: string;
  description?: string;
  confirmText?: string;
  searchPlaceholder?: string;
  /** Already-assigned ids; shown disabled. */
  excludeIds?: readonly string[];
  search: (q: string) => Promise<PickerOption[]>;
  /** Runs with the chosen ids; a thrown error is shown inline and keeps the dialog open. */
  submit?: (ids: string[]) => Promise<unknown>;
}

const SEARCH_DEBOUNCE_MS = 250;

/** Searchable multi-select dialog used to add users, roles, groups and members. */
@Component({
  selector: 'zcc-entity-picker-dialog',
  standalone: true,
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-shell [title]="data.title" [closeResult]="null" [busy]="saving()">
      @if (data.description) {
        <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">{{ data.description }}</p>
      }
      <label class="sr-only" [for]="searchId">Search</label>
      <input
        cdkFocusInitial
        type="search"
        autocomplete="off"
        [id]="searchId"
        [class]="inputClass + ' min-h-[44px]'"
        [placeholder]="data.searchPlaceholder ?? 'Search…'"
        [value]="query()"
        (input)="onQuery($any($event.target).value)"
      />

      <div
        class="mt-3 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10"
        role="listbox"
        aria-multiselectable="true"
        [attr.aria-busy]="loading()"
      >
        @if (loading()) {
          <div class="space-y-2 p-3">
            @for (_ of [1, 2, 3]; track $index) {
              <div class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"></div>
            }
          </div>
        } @else if (loadError()) {
          <p class="p-4 text-sm text-red-500">{{ loadError() }}</p>
        } @else if (!options().length) {
          <p class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No matches.</p>
        } @else {
          @for (opt of options(); track opt.id) {
            <label
              class="flex min-h-[48px] cursor-pointer items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"
              [class.opacity-50]="isExcluded(opt.id)"
              [class.cursor-not-allowed]="isExcluded(opt.id)"
              role="option"
              [attr.aria-selected]="selected().has(opt.id)"
              [attr.aria-level]="(opt.depth ?? 0) + 1"
              [style.padding-left.rem]="0.75 + (opt.depth ?? 0) * 1.25"
            >
              @if (opt.depth) {
                <i class="pi pi-angle-right -mr-1 text-xs text-gray-400" aria-hidden="true"></i>
              }
              <input
                type="checkbox"
                class="size-4 accent-indigo-500"
                [checked]="selected().has(opt.id) || isExcluded(opt.id)"
                [disabled]="isExcluded(opt.id) || saving()"
                (change)="toggle(opt)"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">{{
                  opt.label
                }}</span>
                @if (opt.sublabel) {
                  <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{
                    opt.sublabel
                  }}</span>
                }
              </span>
              @if (opt.badge) {
                <span class="shrink-0 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-400 ring-1 ring-inset ring-gray-500/20">{{ opt.badge }}</span>
              }
              @if (isExcluded(opt.id)) {
                <span class="shrink-0 text-xs text-gray-400">Already added</span>
              }
            </label>
          }
        }
      </div>

      @if (selectedLabels().length) {
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {{ selectedLabels().length }} selected: {{ selectedLabels().join(', ') }}
        </p>
      }
      @if (submitError()) {
        <div
          role="alert"
          class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500"
        >
          {{ submitError() }}
        </div>
      }

      <button
        dialogActions
        type="button"
        class="app-dialog-btn app-dialog-btn--ghost"
        [disabled]="saving()"
        (click)="ref.close(null)"
      >
        Cancel
      </button>
      <button
        dialogActions
        type="button"
        class="app-dialog-btn app-dialog-btn--primary"
        [disabled]="!selected().size || saving()"
        (click)="confirm()"
      >
        {{ saving() ? 'Saving…' : (data.confirmText ?? 'Add') }}
      </button>
    </app-dialog-shell>
  `,
})
export class EntityPickerDialogComponent {
  protected readonly data = injectDialogData<EntityPickerData>();
  protected readonly ref = injectDialogRef<string[] | null>();
  protected readonly inputClass = IAM_INPUT;
  protected readonly searchId = `zcc-picker-search-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly query = signal('');
  protected readonly options = signal<PickerOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitError = signal<string | null>(null);
  /** Remembers labels of picked items even after they scroll out of the current results. */
  protected readonly selected = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly selectedLabels = computed(() => [...this.selected().values()]);

  private readonly excluded = new Set(this.data.excludeIds ?? []);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    void this.load('');
  }

  protected isExcluded(id: string): boolean {
    return this.excluded.has(id);
  }

  protected onQuery(q: string): void {
    this.query.set(q);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.load(q.trim()), SEARCH_DEBOUNCE_MS);
  }

  protected toggle(opt: PickerOption): void {
    this.selected.update((current) => {
      const next = new Map(current);
      if (next.has(opt.id)) next.delete(opt.id);
      else next.set(opt.id, opt.label);
      return next;
    });
  }

  protected async confirm(): Promise<void> {
    const ids = [...this.selected().keys()];
    if (!ids.length) return;
    if (!this.data.submit) {
      this.ref.close(ids);
      return;
    }
    this.saving.set(true);
    this.submitError.set(null);
    try {
      await this.data.submit(ids);
      this.ref.close(ids);
    } catch (err) {
      this.submitError.set(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  private async load(q: string): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const results = await this.data.search(q);
      if (seq === this.requestSeq) this.options.set(results);
    } catch (err) {
      if (seq === this.requestSeq) this.loadError.set(errorMessage(err, 'Could not load options.'));
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }
}
