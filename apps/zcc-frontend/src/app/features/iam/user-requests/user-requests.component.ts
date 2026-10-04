import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateControl, FormInputControl } from '@zellavoras/ui';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SEARCH_ENDPOINTS } from '../../../core/api/search-endpoints';
import { UserRequestsApiService } from '../../../core/api/user-requests.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import {
  UserRequestListItem,
  UserRequestLookups,
  UserRequestSearchCriteria,
  UserRequestStatus,
  UserRequestStatusCounts,
  UserRequestType,
} from '../../../shared/models/user-request.model';
import { countActiveFilters, createSearchStore } from '../../../shared/search';
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

/** Search criteria for the API from the filter form; blanks are sent as null. */
const toCriteria = (f: SearchForm): UserRequestSearchCriteria => ({
  requestRefNo: f.refNo.trim() || null,
  requestType: f.type as UserRequestType[],
  fullName: f.name.trim() || null,
  employeeCode: f.employeeCode.trim() || null,
  emailId: f.email.trim() || null,
  requestedBy: f.requestedById,
  branchId: f.branchId,
  departmentId: f.departmentId,
  teamId: f.teamId,
  groupId: f.groupId,
  roleId: f.roleId,
  statusValue: f.status as UserRequestStatus[],
  requestedFromDate: f.from || null,
  requestedToDate: f.to || null,
});

/** The filter form for applied (or default) criteria. */
const toForm = (c: UserRequestSearchCriteria | null): SearchForm =>
  c
    ? {
        refNo: c.requestRefNo ?? '',
        type: [...c.requestType],
        name: c.fullName ?? '',
        employeeCode: c.employeeCode ?? '',
        email: c.emailId ?? '',
        requestedById: c.requestedBy,
        branchId: [...c.branchId],
        departmentId: [...c.departmentId],
        teamId: [...c.teamId],
        groupId: [...c.groupId],
        roleId: [...c.roleId],
        status: [...c.statusValue],
        from: c.requestedFromDate ?? '',
        to: c.requestedToDate ?? '',
      }
    : structuredClone(EMPTY_FORM);
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
  protected readonly menuFor = signal<string | null>(null);
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

  readonly store = createSearchStore<
    UserRequestSearchCriteria,
    UserRequestListItem,
    UserRequestStatusCounts
  >({ endpoint: SEARCH_ENDPOINTS.userRequests });

  protected readonly counts = this.store.summary;
  /** Column sort shown in the table; null while the server's default order applies. */
  protected readonly sort = this.store.sort;
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
    const current = this.store.criteria()?.statusValue ?? [];
    if (!current.length) return null;
    return current.length === 1 ? current[0] : undefined;
  });

  /** Number of applied search filters, shown on the Filter button. */
  protected readonly activeFilterCount = computed(() => countActiveFilters(this.store.criteria()));

  /** Search filters in effect (sort order alone does not count as a filter). */
  protected readonly filtersActive = computed(() => this.activeFilterCount() > 0);

  constructor() {
    firstValueFrom(this.api.lookups())
      .then((l) => this.lookups.set(l))
      .catch(() => this.lookups.set(null));
  }

  protected search(): void {
    void this.store.search(toCriteria(this.form));
  }

  protected clear(): void {
    this.form = structuredClone(EMPTY_FORM);
    void this.store.reset();
  }

  /** Opens the filter popup on the applied search; Cancel discards edits. */
  protected toggleFilters(event: MouseEvent): void {
    event.stopPropagation();
    this.menuFor.set(null);
    if (this.filtersOpen()) {
      this.cancelFilters();
      return;
    }
    this.form = toForm(this.store.criteria());
    this.filtersOpen.set(true);
  }

  protected applyFilters(): void {
    this.filtersOpen.set(false);
    this.search();
  }

  protected resetDraft(): void {
    this.form = toForm(this.store.defaults());
  }

  protected cancelFilters(): void {
    if (!this.filtersOpen()) return;
    this.form = toForm(this.store.criteria());
    this.filtersOpen.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    this.menuFor.set(null);
    if (!(event.target as HTMLElement | null)?.closest('.filter-anchor')) this.cancelFilters();
  }

  protected onSort(sort: DataTableSort | null): void {
    void this.store.sortBy(sort);
  }

  protected onPaginate({ page, pageSize }: PageChangeEvent): void {
    void this.store.setPage(page, pageSize);
  }

  protected onStatusChip(status: UserRequestStatus | null | undefined): void {
    void this.store.search({ statusValue: status ? [status] : [] });
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
