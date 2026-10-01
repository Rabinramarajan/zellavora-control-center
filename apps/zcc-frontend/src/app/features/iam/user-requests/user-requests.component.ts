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
import {
  DataTableColumn,
  DataTableComponent,
  EmptyStateComponent,
  StatusChipComponent,
} from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_CARD, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { formatDate } from '../shared/iam-format';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { UserSelectComponent } from './components/user-select.component';
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
    EmptyStateComponent,
    StatusChipComponent,
    PaginationComponent,
    MultiSelectComponent,
    UserSelectComponent,
  ],
  template: `
    <zcc-iam-page-header
      title="User Requests"
      icon="pi pi-inbox"
      description="Request, approve and track new accounts and access changes. Every change is provisioned only after approval."
    >
      <a routerLink="create" [class]="btn.primary">
        <i class="pi pi-plus text-xs" aria-hidden="true"></i>
        New Request
      </a>
    </zcc-iam-page-header>

    <form [class]="card + ' mb-4'" (ngSubmit)="search()" aria-label="Search user requests">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <app-form-input-control
          label="Request Ref No"
          icon="search"
          placeholder="UR-2026-…"
          [(value)]="form.refNo"
        />
        <div>
          <label for="ur-type" [class]="labelClass">Request Type</label>
          <zcc-multi-select inputId="ur-type" [options]="typeOptions" [(value)]="form.type" />
        </div>
        <app-form-input-control label="User Name" icon="user" [(value)]="form.name" />
        <div>
          <label for="ur-status" [class]="labelClass">Status</label>
          <zcc-multi-select inputId="ur-status" [options]="statusOptions" [(value)]="form.status" />
        </div>
        <app-date-control label="Requested Date From" [(value)]="form.from" />
        <app-date-control
          label="Requested Date To"
          [minDate]="form.from || undefined"
          [(value)]="form.to"
        />

        @if (moreFilters()) {
          <app-form-input-control label="Employee Code" [(value)]="form.employeeCode" />
          <app-form-input-control label="Email ID" icon="email" [(value)]="form.email" />
          <div>
            <label for="ur-by" [class]="labelClass">Requested By</label>
            <zcc-user-select inputId="ur-by" [(value)]="form.requestedById" />
          </div>
          <div>
            <label for="ur-branch" [class]="labelClass">Branch</label>
            <zcc-multi-select
              inputId="ur-branch"
              [options]="branchOptions()"
              [(value)]="form.branchId"
            />
          </div>
          <div>
            <label for="ur-dept" [class]="labelClass">Department</label>
            <zcc-multi-select
              inputId="ur-dept"
              [options]="departmentOptions()"
              [(value)]="form.departmentId"
            />
          </div>
          <div>
            <label for="ur-team" [class]="labelClass">Team</label>
            <zcc-multi-select inputId="ur-team" [options]="teamOptions()" [(value)]="form.teamId" />
          </div>
          <div>
            <label for="ur-group" [class]="labelClass">Group</label>
            <zcc-multi-select
              inputId="ur-group"
              [options]="groupOptions()"
              [(value)]="form.groupId"
            />
          </div>
          <div>
            <label for="ur-role" [class]="labelClass">Role</label>
            <zcc-multi-select inputId="ur-role" [options]="roleOptions()" [(value)]="form.roleId" />
          </div>
        }
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button type="submit" [class]="btn.primary">
          <i class="pi pi-search text-xs" aria-hidden="true"></i>
          Search
        </button>
        <button type="button" [class]="btn.secondary" (click)="clear()">Clear</button>
        <button
          type="button"
          [class]="btn.secondary"
          [attr.aria-expanded]="moreFilters()"
          (click)="moreFilters.set(!moreFilters())"
        >
          <i class="pi pi-filter text-xs" aria-hidden="true"></i>
          {{ moreFilters() ? 'Fewer Filters' : 'More Filters' }}
        </button>
      </div>
    </form>

    @if (counts()) {
      <div class="mb-4 flex flex-wrap gap-2" aria-label="Requests by status">
        @for (s of quickStatuses; track s) {
          <button
            type="button"
            class="inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors"
            [class]="
              isOnlyStatus(s)
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'
            "
            [attr.aria-pressed]="isOnlyStatus(s)"
            (click)="quickStatus(s)"
          >
            {{ statusLabel(s) }}
            <span class="tabular-nums text-gray-400">{{ counts()![s] }}</span>
          </button>
        }
      </div>
    }

    @if (store.loading() && !store.hasItems()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4, 5]; track $index) {
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load requests"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table [columns]="columns" [rows]="store.items()" [rowTemplate]="rowTpl">
        <ng-template #rowTpl let-r>
          <td class="px-4 py-3">
            <a
              [routerLink]="[r.id]"
              class="font-mono text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >{{ r.refNo }}</a
            >
          </td>
          <td class="px-4 py-3 text-gray-700 dark:text-gray-200">{{ r.typeLabel }}</td>
          <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ r.name ?? '—' }}</td>
          <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
            {{ r.employeeCode ?? '—' }}
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ r.email ?? '—' }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            {{ r.requestedBy?.name ?? '—' }}
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ date(r.createdAt) }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ r.branchName ?? '—' }}</td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="r.status" [label]="r.statusLabel" [tone]="tone(r)" />
          </td>
          <td class="px-4 py-3">
            <div class="relative flex items-center justify-end gap-1">
              <a
                [routerLink]="[r.id]"
                [class]="btn.icon"
                [attr.aria-label]="'View ' + r.refNo"
                title="View"
              >
                <i class="pi pi-eye" aria-hidden="true"></i>
              </a>
              <button
                type="button"
                [class]="btn.icon"
                [attr.aria-label]="'More actions for ' + r.refNo"
                [attr.aria-expanded]="menuFor() === r.id"
                title="More"
                (click)="toggleMenu(r.id, $event)"
              >
                <i class="pi pi-ellipsis-v" aria-hidden="true"></i>
              </button>
              @if (menuFor() === r.id) {
                <div
                  role="menu"
                  class="absolute right-0 top-10 z-20 w-48 rounded-lg border border-gray-200 bg-white p-1 text-left shadow-lg dark:border-white/10 dark:bg-gray-900"
                >
                  @for (item of menuItems; track item.section) {
                    <button
                      type="button"
                      role="menuitem"
                      class="flex min-h-[40px] w-full items-center gap-2 rounded-md px-3 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                      (click)="openSection(r, item.section)"
                    >
                      <i [class]="item.icon + ' text-xs'" aria-hidden="true"></i>
                      {{ item.label }}
                    </button>
                  }
                </div>
              }
            </div>
          </td>
        </ng-template>
      </zcc-data-table>
      <app-pagination
        class="px-1 py-3"
        entityLabel="requests"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-inbox"
        title="No user requests"
        [message]="
          filtersActive()
            ? 'Nothing matches the current filters.'
            : 'Raise a new request to get started.'
        "
      />
    }
  `,
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

  protected readonly columns: DataTableColumn[] = [
    { key: 'refNo', label: 'Request Ref No' },
    { key: 'type', label: 'Request Type' },
    { key: 'name', label: 'Name' },
    { key: 'employeeCode', label: 'Employee Code' },
    { key: 'email', label: 'Email' },
    { key: 'requestedBy', label: 'Requested By' },
    { key: 'requestedDate', label: 'Requested Date' },
    { key: 'branch', label: 'Branch' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
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
