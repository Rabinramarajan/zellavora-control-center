import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DateControl, FormInputControl } from '@zellavoras/ui';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserRequestsApiService } from '../../../core/api/user-requests.api';
import {
  UserRequestListItem,
  UserRequestLookups,
  UserRequestStatus,
} from '../../../shared/models/user-request.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_CARD, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { formatDate } from '../shared/iam-format';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { UserSelectComponent } from './components/user-select.component';
import {
  DataTableColumn,
  DataTableComponent,
  DataTableCellDirective,
  DataTableActionsDirective,
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

const FILTER_KEYS = Object.keys(EMPTY_FORM);
const QUICK_STATUSES: UserRequestStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'SENT_BACK',
  'PROVISIONING',
  'FAILED',
  'COMPLETED',
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
    EmptyStateComponent,
    StatusChipComponent,
    PaginationComponent,
    MultiSelectComponent,
    UserSelectComponent,
  ],
  templateUrl: './user-requests.component.html',
  styleUrl: './user-requests.component.scss',
  host: { '(document:click)': 'menuFor.set(null)' },
})
export class UserRequestsComponent {
  private readonly api = inject(UserRequestsApiService);
  private readonly router = inject(Router);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly labelClass = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400';
  protected readonly typeOptions = REQUEST_TYPE_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly quickStatuses = QUICK_STATUSES;
  protected readonly date = formatDate;
  protected readonly menuItems = [
    { section: 'approval', label: 'Approval', icon: 'pi pi-check-square' },
    { section: 'history', label: 'Status History', icon: 'pi pi-history' },
    { section: 'emails', label: 'Email History', icon: 'pi pi-envelope' },
    { section: 'audit', label: 'Audit', icon: 'pi pi-shield' },
  ];

  protected form: SearchForm = structuredClone(EMPTY_FORM);
  protected readonly moreFilters = signal(false);
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

  protected readonly columns: DataTableColumn<unknown>[] = [
    { id: 'refNo', label: 'Request Ref No' },
    { id: 'type', label: 'Request Type' },
    { id: 'name', label: 'Name' },
    { id: 'employeeCode', label: 'Employee Code' },
    { id: 'email', label: 'Email' },
    { id: 'requestedBy', label: 'Requested By' },
    { id: 'requestedDate', label: 'Requested Date' },
    { id: 'branch', label: 'Branch' },
    { id: 'status', label: 'Status' },
  ];

  readonly store = createListStore<UserRequestListItem>({
    filterKeys: FILTER_KEYS,
    loader: async (query) => {
      const list = await firstValueFrom(this.api.list(query));
      this.counts.set(list.counts);
      return list;
    },
  });

  protected readonly filtersActive = computed(() =>
    Object.values(this.store.filters()).some((v) => (Array.isArray(v) ? v.length : !!v))
  );

  constructor() {
    firstValueFrom(this.api.lookups())
      .then((l) => this.lookups.set(l))
      .catch(() => this.lookups.set(null));
  }

  protected search(): void {
    this.store.setFilters({
      ...this.form,
      refNo: this.form.refNo.trim(),
      name: this.form.name.trim(),
    });
  }

  protected clear(): void {
    this.form = structuredClone(EMPTY_FORM);
    this.store.setFilters({});
  }

  protected quickStatus(status: UserRequestStatus): void {
    this.form = { ...this.form, status: this.isOnlyStatus(status) ? [] : [status] };
    this.search();
  }

  protected isOnlyStatus(status: UserRequestStatus): boolean {
    const current = (this.store.filters()['status'] as string[] | undefined) ?? [];
    return current.length === 1 && current[0] === status;
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
