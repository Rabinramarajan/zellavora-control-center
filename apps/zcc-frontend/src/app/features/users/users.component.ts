import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DateControl, FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { PageChangeEvent } from '../../shared/components/pagination/pagination.component';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  DataTableEmptyDirective,
  DataTableSort,
} from '../../shared/components/data-table';
import { UserAdminApiService } from '../../core/api/user-admin.api';
import { UserRequestsApiService } from '../../core/api/user-requests.api';
import { IamUserListItem } from '../../shared/models/iam.model';
import { createListStore } from '../../shared/utils/create-list-store';
import { IAM_BTN, IamPageHeaderComponent } from '../iam/shared/iam-page-header.component';
import { formatDate } from '../iam/shared/iam-format';

type SortKey = 'fullName' | 'employeeCode' | 'joiningDate' | 'endDate' | 'status';

interface UserFilters {
  firstName: string;
  mobile: string;
  email: string;
  employeeCode: string;
  groupId: string;
  status: string;
  beginFrom: string;
  beginTo: string;
  endFrom: string;
  endTo: string;
}

const EMPTY_FILTERS: UserFilters = {
  firstName: '',
  mobile: '',
  email: '',
  employeeCode: '',
  groupId: '',
  status: '',
  beginFrom: '',
  beginTo: '',
  endFrom: '',
  endTo: '',
};

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as Array<keyof UserFilters>;

const STATUS_OPTIONS: SelectControlOption[] = [
  { value: '', label: '--Select--' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DISABLED', label: 'Disabled' },
];

/**
 * Read-only User Search. Accounts are created and changed only through
 * User Request → Approval → Provisioning, so this screen has no edit actions.
 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    RouterLink,
    FormInputControl,
    SelectControl,
    DateControl,
    IamPageHeaderComponent,
    DataTableComponent,
    DataTableCellDirective,
    DataTableEmptyDirective,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'filtersOpen.set(false)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class UsersComponent {
  private readonly api = inject(UserAdminApiService);
  private readonly requestsApi = inject(UserRequestsApiService);

  protected readonly btn = IAM_BTN;
  protected readonly pageSizes = [10, 25, 50, 100];
  protected readonly statusOptions = STATUS_OPTIONS;

  private readonly groups = signal<Array<{ id: string; name: string }>>([]);
  protected readonly groupOptions = computed<SelectControlOption[]>(() => [
    { value: '', label: '--Select--' },
    ...this.groups().map((g) => ({ value: g.id, label: g.name })),
  ]);

  protected readonly columns: DataTableColumn<IamUserListItem>[] = [
    { id: 'fullName', label: 'Employee Name', sortKey: 'fullName' },
    {
      id: 'employeeCode',
      label: 'Employee Code',
      sortKey: 'employeeCode',
      value: (u) => u.employeeCode ?? '—',
    },
    { id: 'username', label: 'User Name', value: (u) => u.username ?? u.firstName ?? '—' },
    {
      id: 'beginDate',
      label: 'Begin Date',
      sortKey: 'joiningDate',
      value: (u) => (u.beginDate ? formatDate(u.beginDate) : '—'),
      cellClass: 'whitespace-nowrap',
    },
    {
      id: 'endDate',
      label: 'End Date',
      sortKey: 'endDate',
      value: (u) => (u.endDate ? formatDate(u.endDate) : ''),
      cellClass: 'whitespace-nowrap',
    },
    { id: 'status', label: 'Status', sortKey: 'status', value: (u) => u.statusLabel },
  ];

  protected readonly userId = (u: IamUserListItem): string => u.id;
  protected readonly userName = (u: IamUserListItem): string => u.fullName;

  protected readonly store = createListStore<IamUserListItem>({
    initialPageSize: 10,
    // The constructor's pushFilters() issues the first load with the default sort.
    autoLoad: false,
    filterKeys: [...FILTER_KEYS, 'sort', 'order'],
    loader: (query) => firstValueFrom(this.api.search(query)),
  });

  protected readonly filtersOpen = signal(false);
  protected readonly draft = signal<UserFilters>({ ...EMPTY_FILTERS });
  protected readonly applied = signal<UserFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = signal<DataTableSort<SortKey>>({ key: 'joiningDate', dir: 'desc' });

  protected readonly activeFilterCount = computed(
    () => FILTER_KEYS.filter((k) => this.applied()[k].trim()).length
  );

  public constructor() {
    firstValueFrom(this.requestsApi.lookups())
      .then((l) => this.groups.set(l.groups ?? []))
      .catch(() => this.groups.set([]));
    this.pushFilters();
  }

  protected patch(key: keyof UserFilters, value: string | null): void {
    this.draft.update((d) => ({ ...d, [key]: value ?? '' }));
  }

  /** Opens the filter popup on a copy of the applied filters; closing discards edits. */
  protected toggleFilters(): void {
    if (!this.filtersOpen()) this.draft.set({ ...this.applied() });
    this.filtersOpen.update((open) => !open);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement | null)?.closest('.filter-anchor'))
      this.filtersOpen.set(false);
  }

  protected search(): void {
    this.applied.set({ ...this.draft() });
    this.filtersOpen.set(false);
    this.pushFilters();
  }

  protected clear(): void {
    this.draft.set({ ...EMPTY_FILTERS });
    this.applied.set({ ...EMPTY_FILTERS });
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
    for (const key of FILTER_KEYS) if (f[key].trim()) filters[key] = f[key].trim();
    this.store.setFilters(filters);
  }
}
