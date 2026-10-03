import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { EntityStatus, GroupListItem, GroupStats } from '../../../shared/models/iam.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { StatusChipComponent } from '../../../shared/components/iam';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  DataTableSort,
} from '../../../shared/components/data-table';
import { FilterChipOption, FilterChipsComponent } from '../../../shared/components/filter-chips';
import { FormDialogService, FormFieldOption } from '../../../shared/components/form-dialog';
import { PageChangeEvent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { formatDate } from '../shared/iam-format';
import {
  GROUP_STATUS_OPTIONS,
  GROUP_TYPE_OPTIONS,
  groupDialogConfig,
  groupTypeTone,
  groupStatusLabel,
  toGroupRequest,
} from './group-dialog.config';

type SortKey = 'name' | 'type' | 'status' | 'createdAt';

interface GroupFilters {
  q: string;
  type: string;
  status: string;
  parentId: string;
}

const EMPTY_FILTERS: GroupFilters = { q: '', type: '', status: '', parentId: '' };
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof GroupFilters>;
const ANY: SelectControlOption = { value: '', label: '--Select--' };
/** Enough for a parent picker; the API caps a page at 100. */
const PARENT_PAGE_SIZE = 100;

@Component({
  selector: 'zcc-groups-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormInputControl,
    SelectControl,
    StatusChipComponent,
    IamPageHeaderComponent,
    FilterChipsComponent,
    DataTableComponent,
    DataTableCellDirective,
    DataTableEmptyDirective,
  ],
  host: {
    '(document:keydown.escape)': 'filtersOpen.set(false)',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './groups-list.component.html',
  styleUrl: './groups-list.component.scss',
})
export class GroupsListComponent {
  private readonly api = inject(IamApiService);
  private readonly router = inject(Router);
  private readonly formDialog = inject(FormDialogService);
  protected readonly canManage = inject(PermissionService).can('groups:manage');

  protected readonly btn = IAM_BTN;
  protected readonly typeTone = groupTypeTone;
  protected readonly statusLabel = groupStatusLabel;
  protected readonly pageSizes = [10, 25, 50, 100];
  protected readonly typeOptions: SelectControlOption[] = [ANY, ...GROUP_TYPE_OPTIONS];
  protected readonly statusOptions: SelectControlOption[] = [ANY, ...GROUP_STATUS_OPTIONS];

  private readonly parents = signal<FormFieldOption[]>([]);
  protected readonly parentOptions = computed<SelectControlOption[]>(() => [
    ANY,
    ...this.parents(),
  ]);

  private readonly stats = signal<GroupStats | null>(null);
  protected readonly statusChips = computed<FilterChipOption<EntityStatus>[]>(() =>
    GROUP_STATUS_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      count: this.stats() ? (this.stats()!.byStatus[o.value] ?? 0) : null,
    }))
  );
  protected readonly totalCount = computed(() => this.stats()?.total ?? null);
  protected readonly activeStatus = computed<EntityStatus | null>(
    () => (this.applied().status as EntityStatus) || null
  );

  protected readonly columns: DataTableColumn<GroupListItem>[] = [
    { id: 'name', label: 'Group Name', sortKey: 'name' },
    { id: 'type', label: 'Type', sortKey: 'type' },
    { id: 'parent', label: 'Parent Group', value: (g) => g.parentName ?? '—' },
    {
      id: 'memberCount',
      label: 'Members',
      value: (g) => g.memberCount,
      cellClass: 'tabular-nums',
    },
    { id: 'roleCount', label: 'Roles', value: (g) => g.roleCount, cellClass: 'tabular-nums' },
    {
      id: 'createdAt',
      label: 'Created On',
      sortKey: 'createdAt',
      value: (g) => formatDate(g.createdAt),
      cellClass: 'whitespace-nowrap',
    },
    { id: 'status', label: 'Status', sortKey: 'status' },
  ];

  protected readonly groupId = (g: GroupListItem): string => g.id;
  protected readonly groupName = (g: GroupListItem): string => g.name;

  protected readonly store = createListStore<GroupListItem>({
    initialPageSize: 10,
    // The constructor's pushFilters() issues the first load with the default sort.
    autoLoad: false,
    filterKeys: ['q', 'type', 'status', 'parentId', 'sort', 'order'],
    loader: (query) => firstValueFrom(this.api.listGroups(query)).then(unwrap),
  });

  protected readonly filtersOpen = signal(false);
  protected readonly draft = signal<GroupFilters>({ ...EMPTY_FILTERS });
  protected readonly applied = signal<GroupFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = signal<DataTableSort<SortKey>>({ key: 'name', dir: 'asc' });

  protected readonly activeFilterCount = computed(
    () => FILTER_KEYS.filter((k) => this.applied()[k].trim()).length
  );

  public constructor() {
    this.pushFilters();
    void this.loadStats();
    void this.loadParents();
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  protected patch(key: keyof GroupFilters, value: string | null): void {
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

  protected onStatusChip(status: EntityStatus | null | undefined): void {
    this.applied.update((f) => ({ ...f, status: status ?? '' }));
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

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  protected async createGroup(): Promise<void> {
    const created = await this.formDialog.open(
      groupDialogConfig('create', this.parents(), (values) =>
        firstValueFrom(this.api.createGroup(toGroupRequest(values))).then(unwrap)
      )
    );
    if (created) await this.router.navigate(['/iam/groups', created.id]);
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  private pushFilters(): void {
    const f = this.applied();
    const filters: Record<string, string | string[]> = {
      sort: this.sort().key,
      order: this.sort().dir,
    };
    if (f.type) filters['type'] = [f.type];
    if (f.status) filters['status'] = [f.status];
    if (f.parentId) filters['parentId'] = f.parentId;
    if (f.q.trim()) filters['q'] = f.q.trim();
    this.store.setFilters(filters);
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats.set(unwrap(await firstValueFrom(this.api.groupStats())));
    } catch {
      this.stats.set({ total: 0, byStatus: {}, byType: {} });
    }
  }

  private async loadParents(): Promise<void> {
    try {
      const page = unwrap(
        await firstValueFrom(
          this.api.listGroups({ page: 1, pageSize: PARENT_PAGE_SIZE, sort: 'name', order: 'asc' })
        )
      );
      this.parents.set(page.data.map((g) => ({ value: g.id, label: g.name })));
    } catch {
      this.parents.set([]);
    }
  }
}
