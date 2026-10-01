import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  DialogShellComponent,
  injectDialogData,
  injectDialogRef,
} from '../../../shared/components/dialog';
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
  templateUrl: './entity-picker-dialog.component.html',
  styleUrl: './entity-picker-dialog.component.scss',
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
