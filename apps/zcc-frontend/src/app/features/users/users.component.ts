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
import { UserRequestsApiService } from '../../core/api/user-requests.api';
import { SEARCH_ENDPOINTS } from '../../core/api/search-endpoints';
import { IamUserListItem, UserSearchCriteria } from '../../shared/models/iam.model';
import { countActiveFilters, createSearchStore } from '../../shared/search';
import { IAM_BTN, IamPageHeaderComponent } from '../iam/shared/iam-page-header.component';
import { formatDate } from '../iam/shared/iam-format';

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

const toCriteria = (f: UserFilters): UserSearchCriteria => ({
  userLoginId: null,
  firstName: f.firstName.trim() || null,
  emailId: f.email.trim() || null,
  contactNumber: f.mobile.trim() || null,
  employeeCode: f.employeeCode.trim() || null,
  groupId: f.groupId || null,
  statusValue: f.status || null,
  beginFromDate: f.beginFrom || null,
  beginToDate: f.beginTo || null,
  endFromDate: f.endFrom || null,
  endToDate: f.endTo || null,
});

const toFilters = (c: UserSearchCriteria | null): UserFilters => ({
  firstName: c?.firstName ?? '',
  mobile: c?.contactNumber ?? '',
  email: c?.emailId ?? '',
  employeeCode: c?.employeeCode ?? '',
  groupId: c?.groupId ?? '',
  status: c?.statusValue ?? '',
  beginFrom: c?.beginFromDate ?? '',
  beginTo: c?.beginToDate ?? '',
  endFrom: c?.endFromDate ?? '',
  endTo: c?.endToDate ?? '',
});

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

  protected readonly store = createSearchStore<UserSearchCriteria, IamUserListItem>({
    endpoint: SEARCH_ENDPOINTS.users,
  });

  protected readonly filtersOpen = signal(false);
  protected readonly draft = signal<UserFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = this.store.sort;

  protected readonly activeFilterCount = computed(() => countActiveFilters(this.store.criteria()));

  public constructor() {
    firstValueFrom(this.requestsApi.lookups())
      .then((l) => this.groups.set(l.groups ?? []))
      .catch(() => this.groups.set([]));
  }

  protected patch(key: keyof UserFilters, value: string | null): void {
    this.draft.update((d) => ({ ...d, [key]: value ?? '' }));
  }

  /** Opens the filter popup on a copy of the applied filters; closing discards edits. */
  protected toggleFilters(): void {
    if (!this.filtersOpen()) this.draft.set(toFilters(this.store.criteria()));
    this.filtersOpen.update((open) => !open);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement | null)?.closest('.filter-anchor'))
      this.filtersOpen.set(false);
  }

  protected search(): void {
    this.filtersOpen.set(false);
    void this.store.search(toCriteria(this.draft()));
  }

  protected clear(): void {
    this.draft.set({ ...EMPTY_FILTERS });
    void this.store.reset();
  }

  protected onSort(sort: DataTableSort | null): void {
    void this.store.sortBy(sort);
  }

  protected onPaginate({ page, pageSize }: PageChangeEvent): void {
    void this.store.setPage(page, pageSize);
  }
}
