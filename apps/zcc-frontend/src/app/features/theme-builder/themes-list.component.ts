import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { ThemesApiService } from '../../core/api/themes.api';
import { PermissionService } from '../../core/rbac/services/permission.service';
import { ThemeRuntimeService } from '../../core/theme/theme-runtime.service';
import { Theme } from '../../shared/models/theme-builder.model';
import { createListStore } from '../../shared/utils/create-list-store';
import { StatusChipComponent } from '../../shared/components/iam';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  DataTableSort,
} from '../../shared/components/data-table';
import { PageChangeEvent } from '../../shared/components/pagination/pagination.component';
import { IAM_BTN, IamPageHeaderComponent } from '../iam/shared/iam-page-header.component';
import { formatDate } from '../iam/shared/iam-format';

type SortKey = 'name' | 'updatedAt' | 'createdAt';

interface ThemeFilters {
  q: string;
  mode: string;
}

const EMPTY_FILTERS: ThemeFilters = { q: '', mode: '' };
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof ThemeFilters>;

@Component({
  selector: 'app-themes-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormInputControl,
    SelectControl,
    StatusChipComponent,
    IamPageHeaderComponent,
    DataTableComponent,
    DataTableCellDirective,
    DataTableEmptyDirective,
  ],
  host: {
    '(document:keydown.escape)': 'filtersOpen.set(false)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './themes-list.component.html',
  styleUrl: './themes-list.component.scss',
})
export class ThemesListComponent {
  private readonly api = inject(ThemesApiService);
  protected readonly runtime = inject(ThemeRuntimeService);
  protected readonly canManage = inject(PermissionService).can('themes:manage');

  protected readonly btn = IAM_BTN;
  protected readonly date = formatDate;
  protected readonly pageSizes = [10, 25, 50];
  protected readonly modeOptions: SelectControlOption[] = [
    { value: '', label: '--Select--' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected readonly columns: DataTableColumn<Theme>[] = [
    { id: 'name', label: 'Theme Name', sortKey: 'name' },
    { id: 'colors', label: 'Colours' },
    { id: 'font', label: 'Font', value: (t) => t.fontFamily },
    {
      id: 'radius',
      label: 'Corner Radius',
      value: (t) => `${t.borderRadius}px`,
      cellClass: 'tabular-nums',
    },
    { id: 'mode', label: 'Default Mode', value: (t) => (t.mode === 'dark' ? 'Dark' : 'Light') },
    {
      id: 'updatedAt',
      label: 'Last Updated',
      sortKey: 'updatedAt',
      value: (t) => (t.updatedAt ? formatDate(t.updatedAt) : '—'),
      cellClass: 'whitespace-nowrap',
    },
    { id: 'status', label: 'Status' },
  ];

  protected readonly themeId = (t: Theme): string => t.id ?? 'default';
  protected readonly themeName = (t: Theme): string => t.name;

  protected readonly store = createListStore<Theme>({
    initialPageSize: 10,
    // The constructor's pushFilters() issues the first load with the default sort.
    autoLoad: false,
    filterKeys: ['q', 'mode', 'sort', 'order'],
    loader: (query) =>
      firstValueFrom(
        this.api.list({
          q: query['q'],
          mode: query['mode'],
          page: query.page,
          pageSize: query.pageSize,
          sort: query['sort'],
          order: query['order'],
        })
      ),
  });

  protected readonly filtersOpen = signal(false);
  protected readonly draft = signal<ThemeFilters>({ ...EMPTY_FILTERS });
  protected readonly applied = signal<ThemeFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = signal<DataTableSort<SortKey>>({ key: 'updatedAt', dir: 'desc' });
  protected readonly activeFilterCount = computed(
    () => FILTER_KEYS.filter((k) => this.applied()[k].trim()).length
  );

  /** Shown above the table when the organization still uses the built-in look. */
  protected readonly usingDefault = computed(() => this.runtime.active()?.id === null);

  public constructor() {
    this.pushFilters();
  }

  protected patch(key: keyof ThemeFilters, value: string | null): void {
    this.draft.update((d) => ({ ...d, [key]: value ?? '' }));
  }

  /** Opens the filter popup on a copy of the applied filters; closing discards edits. */
  protected toggleFilters(): void {
    if (!this.filtersOpen()) this.draft.set({ ...this.applied() });
    this.filtersOpen.update((open) => !open);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement | null)?.closest('.filter-anchor')) {
      this.filtersOpen.set(false);
    }
  }

  protected search(): void {
    this.applied.set({ ...this.draft() });
    this.filtersOpen.set(false);
    this.pushFilters();
  }

  protected clear(): void {
    this.draft.set({ ...EMPTY_FILTERS });
    this.applied.set({ ...EMPTY_FILTERS });
    this.filtersOpen.set(false);
    this.pushFilters();
  }

  protected onSort(sort: DataTableSort | null): void {
    if (!sort) return;
    this.sort.set(sort as DataTableSort<SortKey>);
    this.pushFilters();
  }

  protected onPaginate({ page, pageSize }: PageChangeEvent): void {
    if (pageSize !== this.store.pageSize()) this.store.setPageSize(pageSize);
    else this.store.setPage(page);
  }

  private pushFilters(): void {
    const f = this.applied();
    const filters: Record<string, string> = { sort: this.sort().key, order: this.sort().dir };
    if (f.q.trim()) filters['q'] = f.q.trim();
    if (f.mode) filters['mode'] = f.mode;
    this.store.setFilters(filters);
  }
}
