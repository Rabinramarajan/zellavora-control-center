import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateControl, FormInputControl } from '@zellavoras/ui';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserRequestsApiService } from '../../../core/api/user-requests.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import {
  UserRequestListItem,
  UserRequestLookups,
  UserRequestStatus,
} from '../../../shared/models/user-request.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { StatusChipComponent } from '../../../shared/components/iam';
import { FilterChipOption, FilterChipsComponent } from '../../../shared/components/filter-chips';
import { PageChangeEvent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { formatDate } from '../shared/iam-format';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { UserSelectComponent } from './components/user-select.component';
import {
  DataTableColumn,
  DataTableComponent,
  DataTableCellDirective,
  DataTableActionsDirective,
  DataTableEmptyDirective,
  DataTableSort,
} from '../../../shared/components/data-table';
import { REQUEST_TYPE_OPTIONS, STATUS_OPTIONS, STATUS_TONES } from './user-request.constants';

interface SearchForm {
  refNo: string;
  type: string[];
  name: string;
  employeeCode: string;
  email: string;
  requestedById: string | null;
  branchId: string[];
  departmentId: string[];
  teamId: string[];
  groupId: string[];
  roleId: string[];
  status: string[];
  from: string;
  to: string;
}

const EMPTY_FORM: SearchForm = {
  refNo: '',
  type: [],
  name: '',
  employeeCode: '',
  email: '',
  requestedById: null,
  branchId: [],
  departmentId: [],
  teamId: [],
  groupId: [],
  roleId: [],
  status: [],
  from: '',
  to: '',
};

const FILTER_KEYS = [...Object.keys(EMPTY_FORM), 'sort', 'order'];

/** Columns the API can sort by (user-request.dto `sort`). */
type SortKey = 'refNo' | 'subjectName' | 'createdAt' | 'status' | 'priority';
/** Every request status gets a quick-filter chip, in workflow order. */
const QUICK_STATUSES: UserRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_VERIFICATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'PROVISIONING',
  'COMPLETED',
  'SENT_BACK',
  'REJECTED',
  'CANCELLED',
  'FAILED',
];

const toOptions = (items: Array<{ id: string; name: string }>): MultiSelectOption[] =>
  items.map((i) => ({ value: i.id, label: i.name }));

@Component({
  selector: 'zcc-user-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    FormInputControl,
    DateControl,
    IamPageHeaderComponent,
    DataTableComponent,
    DataTableCellDirective,
    DataTableActionsDirective,
    DataTableEmptyDirective,
    StatusChipComponent,
    MultiSelectComponent,
    UserSelectComponent,
    FilterChipsComponent,
  ],
  templateUrl: './user-requests.component.html',
  styleUrl: './user-requests.component.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'cancelFilters()',
  },
})
export class UserRequestsComponent {
  private readonly api = inject(UserRequestsApiService);
  private readonly router = inject(Router);

  protected readonly canCreate = inject(PermissionService).can('user-requests:create');
  protected readonly btn = IAM_BTN;
  protected readonly labelClass =
    // Matches the @zellavoras/ui field label (13px, medium, 8px above the control).
    'mb-2 block ps-0.5 text-[13px] font-medium leading-tight text-gray-600 dark:text-gray-400';
  protected readonly typeOptions = REQUEST_TYPE_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly date = formatDate;
  protected readonly menuItems = [
    { section: 'approval', label: 'Approval', icon: 'pi pi-check-square' },
    { section: 'history', label: 'Status History', icon: 'pi pi-history' },
    { section: 'emails', label: 'Email History', icon: 'pi pi-envelope' },
    { section: 'audit', label: 'Audit', icon: 'pi pi-shield' },
  ];

  protected form: SearchForm = structuredClone(EMPTY_FORM);
  protected readonly filtersOpen = signal(false);
  /** The last searched form, restored when the popup is cancelled. */
  private appliedForm: SearchForm = structuredClone(EMPTY_FORM);
  protected readonly menuFor = signal<string | null>(null);
  protected readonly counts = signal<Record<UserRequestStatus, number> | null>(null);
  private readonly lookups = signal<UserRequestLookups | null>(null);

  protected readonly branchOptions = computed(() => toOptions(this.lookups()?.branches ?? []));
  protected readonly departmentOptions = computed(() =>
    toOptions(this.lookups()?.departments ?? [])
  );
  protected readonly teamOptions = computed(() => toOptions(this.lookups()?.teams ?? []));
  protected readonly groupOptions = computed(() => toOptions(this.lookups()?.groups ?? []));
  protected readonly roleOptions = computed(() => toOptions(this.lookups()?.roles ?? []));

  protected readonly columns: DataTableColumn<UserRequestListItem>[] = [
    { id: 'refNo', label: 'Request Ref No', sortKey: 'refNo' },
    { id: 'type', label: 'Request Type' },
    { id: 'name', label: 'Name', sortKey: 'subjectName' },
    { id: 'employeeCode', label: 'Employee Code' },
    { id: 'email', label: 'Email' },
    { id: 'requestedBy', label: 'Requested By' },
    { id: 'requestedDate', label: 'Requested Date', sortKey: 'createdAt' },
    { id: 'branch', label: 'Branch' },
    { id: 'status', label: 'Status', sortKey: 'status' },
  ];

  protected readonly pageSizes = [10, 25, 50, 100];
  protected readonly sort = signal<DataTableSort<SortKey>>({ key: 'createdAt', dir: 'desc' });
  protected readonly requestId = (r: UserRequestListItem): string => r.id;
  protected readonly requestLabel = (r: UserRequestListItem): string => r.refNo;
  /** Sum of the per-status counts, for the "All Requests" chip. */
  protected readonly totalCount = computed(() => {
    const c = this.counts();
    return c ? Object.values(c).reduce((sum, n) => sum + n, 0) : null;
  });
  protected readonly statusChips = computed<FilterChipOption<UserRequestStatus>[]>(() =>
    QUICK_STATUSES.map((value) => ({
      value,
      label: this.statusLabel(value),
      count: this.counts()?.[value] ?? null,
    }))
  );
  /** `null` = no status filter; `undefined` = a multi-status filter no chip represents. */
  protected readonly activeStatus = computed<UserRequestStatus | null | undefined>(() => {
    const current = (this.store.filters()['status'] as UserRequestStatus[] | undefined) ?? [];
    if (!current.length) return null;
    return current.length === 1 ? current[0] : undefined;
  });

  readonly store = createListStore<UserRequestListItem>({
    filterKeys: FILTER_KEYS,
    loader: async (query) => {
      const list = await firstValueFrom(this.api.list(query));
      this.counts.set(list.counts);
      return list;
    },
  });

  /** Number of applied search filters, shown on the Filter button. */
  protected readonly activeFilterCount = computed(
    () =>
      Object.entries(this.store.filters()).filter(
        ([k, v]) => k !== 'sort' && k !== 'order' && (Array.isArray(v) ? v.length > 0 : !!v)
      ).length
  );

  /** Search filters in effect (sort order alone does not count as a filter). */
  protected readonly filtersActive = computed(() =>
    Object.entries(this.store.filters()).some(
      ([k, v]) => k !== 'sort' && k !== 'order' && (Array.isArray(v) ? v.length : !!v)
    )
  );

  constructor() {
    firstValueFrom(this.api.lookups())
      .then((l) => this.lookups.set(l))
      .catch(() => this.lookups.set(null));
  }

  protected search(): void {
    this.appliedForm = structuredClone(this.form);
    this.store.setFilters({
      ...this.form,
      refNo: this.form.refNo.trim(),
      name: this.form.name.trim(),
      ...this.sortFilters(),
    });
  }

  protected clear(): void {
    this.form = structuredClone(EMPTY_FORM);
    this.appliedForm = structuredClone(EMPTY_FORM);
    this.store.setFilters(this.sortFilters());
  }

  /** Opens the filter popup on the applied search; Cancel discards edits. */
  protected toggleFilters(event: MouseEvent): void {
    event.stopPropagation();
    this.menuFor.set(null);
    if (this.filtersOpen()) {
      this.cancelFilters();
      return;
    }
    this.form = structuredClone(this.appliedForm);
    this.filtersOpen.set(true);
  }

  protected applyFilters(): void {
    this.filtersOpen.set(false);
    this.search();
  }

  protected resetDraft(): void {
    this.form = structuredClone(EMPTY_FORM);
  }

  protected cancelFilters(): void {
    if (!this.filtersOpen()) return;
    this.form = structuredClone(this.appliedForm);
    this.filtersOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    this.menuFor.set(null);
    if (!(event.target as HTMLElement | null)?.closest('.filter-anchor')) this.cancelFilters();
  }

  protected onSort(sort: DataTableSort | null): void {
    if (!sort) return;
    this.sort.set(sort as DataTableSort<SortKey>);
    this.search();
  }

  protected onPaginate({ page, pageSize }: PageChangeEvent): void {
    if (pageSize !== this.store.pageSize()) this.store.setPageSize(pageSize);
    else this.store.setPage(page);
  }

  private sortFilters() {
    return { sort: this.sort().key, order: this.sort().dir };
  }

  protected onStatusChip(status: UserRequestStatus | null | undefined): void {
    this.form = { ...this.form, status: status ? [status] : [] };
    this.search();
  }

  protected statusLabel(status: UserRequestStatus): string {
    return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
  }

  protected tone(r: UserRequestListItem) {
    return STATUS_TONES[r.status];
  }

  protected toggleMenu(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.menuFor.set(this.menuFor() === id ? null : id);
  }

  protected openSection(r: UserRequestListItem, section: string): void {
    this.menuFor.set(null);
    void this.router.navigate(['/iam/user-requests', r.id], { queryParams: { section } });
  }
}
