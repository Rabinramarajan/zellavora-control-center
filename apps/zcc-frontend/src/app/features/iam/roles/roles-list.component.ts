import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { EntityStatus, RoleListItem, RoleStats } from '../../../shared/models/iam.model';
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
import { FormDialogService } from '../../../shared/components/form-dialog';
import { PageChangeEvent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import {
  ROLE_SCOPE_OPTIONS,
  ROLE_STATUS_OPTIONS,
  roleDialogConfig,
  roleScopeLabel,
  roleScopeTone,
  roleStatusLabel,
  toRoleRequest,
} from './role-dialog.config';

type SortKey = 'name' | 'scope' | 'status' | 'createdAt';

interface RoleFilters {
  q: string;
  scope: string;
  status: string;
}

const EMPTY_FILTERS: RoleFilters = { q: '', scope: '', status: '' };
const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof RoleFilters>;
const ANY: SelectControlOption = { value: '', label: '--Select--' };

@Component({
  selector: 'zcc-roles-list',
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
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
})
export class RolesListComponent {
  private readonly api = inject(IamApiService);
  private readonly router = inject(Router);
  private readonly formDialog = inject(FormDialogService);
  protected readonly canManage = inject(PermissionService).can('roles:manage');

  protected readonly btn = IAM_BTN;
  protected readonly scopeTone = roleScopeTone;
  protected readonly scopeLabel = roleScopeLabel;
  protected readonly statusLabel = roleStatusLabel;
  protected readonly pageSizes = [10, 25, 50, 100];
  protected readonly scopeOptions: SelectControlOption[] = [ANY, ...ROLE_SCOPE_OPTIONS];
  protected readonly statusOptions: SelectControlOption[] = [ANY, ...ROLE_STATUS_OPTIONS];

  private readonly stats = signal<RoleStats | null>(null);
  protected readonly statusChips = computed<FilterChipOption<EntityStatus>[]>(() =>
    ROLE_STATUS_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      count: this.stats() ? (this.stats()!.byStatus[o.value] ?? 0) : null,
    }))
  );
  protected readonly totalCount = computed(() => this.stats()?.total ?? null);
  protected readonly activeStatus = computed<EntityStatus | null>(
    () => (this.applied().status as EntityStatus) || null
  );

  protected readonly columns: DataTableColumn<RoleListItem>[] = [
    { id: 'name', label: 'Role Name', sortKey: 'name' },
    {
      id: 'key',
      label: 'Role Key',
      value: (r) => r.key,
      cellClass: 'whitespace-nowrap font-mono text-xs',
    },
    { id: 'scope', label: 'Scope', sortKey: 'scope' },
    { id: 'userCount', label: 'Users', value: (r) => r.userCount, cellClass: 'tabular-nums' },
    { id: 'groupCount', label: 'Groups', value: (r) => r.groupCount, cellClass: 'tabular-nums' },
    {
      id: 'permissionCount',
      label: 'Permissions',
      value: (r) => r.permissionCount,
      cellClass: 'tabular-nums',
    },
    { id: 'status', label: 'Status', sortKey: 'status' },
  ];

  protected readonly roleId = (r: RoleListItem): string => r.id;
  protected readonly roleName = (r: RoleListItem): string => r.name;

  protected readonly store = createListStore<RoleListItem>({
    initialPageSize: 10,
    // The constructor's pushFilters() issues the first load with the default sort.
    autoLoad: false,
    filterKeys: ['q', 'scope', 'status', 'sort', 'order'],
    loader: (query) => firstValueFrom(this.api.listRoles(query)).then(unwrap),
  });

  protected readonly filtersOpen = signal(false);
  protected readonly draft = signal<RoleFilters>({ ...EMPTY_FILTERS });
  protected readonly applied = signal<RoleFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = signal<DataTableSort<SortKey>>({ key: 'name', dir: 'asc' });

  protected readonly activeFilterCount = computed(
    () => FILTER_KEYS.filter((k) => this.applied()[k].trim()).length
  );

  public constructor() {
    this.pushFilters();
    void this.loadStats();
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  protected patch(key: keyof RoleFilters, value: string | null): void {
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

  protected async createRole(): Promise<void> {
    const created = await this.formDialog.open(
      roleDialogConfig('create', (values) =>
        firstValueFrom(this.api.createRole(toRoleRequest(values))).then(unwrap)
      )
    );
    // Straight to the new role so its permissions can be chosen.
    if (created) await this.router.navigate(['/iam/roles', created.id]);
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
    if (f.scope) filters['scope'] = [f.scope];
    if (f.status) filters['status'] = [f.status];
    if (f.q.trim()) filters['q'] = f.q.trim();
    this.store.setFilters(filters);
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats.set(unwrap(await firstValueFrom(this.api.roleStats())));
    } catch {
      this.stats.set({ total: 0, byStatus: {}, byScope: {} });
    }
  }
}
