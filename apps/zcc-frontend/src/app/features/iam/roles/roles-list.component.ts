import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DateControl, FormInputControl } from '@zellavoras/ui';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '@core/api/iam.api';
import { RoleListItem } from '@shared/models/iam.model';
import { createListStore } from '@shared/utils/create-list-store';
import {
  DataTableColumn,
  DataTableComponent,
  EmptyStateComponent,
  StatusChipComponent,
} from '@shared/components/iam';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_CARD, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { formatDate } from '../shared/iam-format';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import { UserSelectComponent } from '../user-requests/components/user-select.component';

interface RoleSearchForm {
  q: string;
  status: string[];
  type: string[];
  scope: string[];
  resource: string[];
  permission: string[];
  groupId: string[];
  createdBy: string | null;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
}

const EMPTY_FORM: RoleSearchForm = {
  q: '',
  status: [],
  type: [],
  scope: [],
  resource: [],
  permission: [],
  groupId: [],
  createdBy: null,
  createdFrom: '',
  createdTo: '',
  updatedFrom: '',
  updatedTo: '',
};

const FILTER_KEYS = Object.keys(EMPTY_FORM).filter((key) => key !== 'q');

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const TYPE_OPTIONS: MultiSelectOption[] = [
  { value: 'SYSTEM', label: 'System' },
  { value: 'CUSTOM', label: 'Custom' },
];

const SCOPE_OPTIONS: MultiSelectOption[] = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'ORG', label: 'Organization' },
  { value: 'RESOURCE', label: 'Resource' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'TEAM', label: 'Team' },
  { value: 'OWN', label: 'Own Records' },
];

const RESOURCE_OPTIONS: MultiSelectOption[] = [
  { value: 'users', label: 'Users' },
  { value: 'user-requests', label: 'User Requests' },
  { value: 'groups', label: 'Groups' },
  { value: 'roles', label: 'Roles' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'projects', label: 'Projects' },
  { value: 'blog', label: 'Blog' },
  { value: 'audit', label: 'Audit Logs' },
];

const PERMISSION_OPTIONS: MultiSelectOption[] = [
  { value: 'read', label: 'Read' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'approve', label: 'Approve' },
  { value: 'manage', label: 'Manage' },
];

@Component({
  selector: 'zcc-roles-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    FormInputControl,
    DateControl,
    IamPageHeaderComponent,
    DataTableComponent,
    PaginationComponent,
    StatusChipComponent,
    EmptyStateComponent,
    MultiSelectComponent,
    UserSelectComponent,
  ],
  template: `
    <zcc-iam-page-header
      title="Roles"
      icon="pi pi-shield"
      description="Find, manage and audit reusable RBAC roles across permissions, resources, groups and users."
    >
      <a routerLink="/iam/roles/new" [class]="btn.primary">
        <i class="pi pi-plus text-xs" aria-hidden="true"></i>
        Create Role
      </a>
    </zcc-iam-page-header>

    <form [class]="card + ' mb-4'" (ngSubmit)="search()" aria-label="Search roles">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <app-form-input-control
          label="Role Name / Code"
          icon="search"
          placeholder="USER_ADMIN"
          [(value)]="form.q"
        />
        <div>
          <label for="role-status" [class]="labelClass">Status</label>
          <zcc-multi-select
            inputId="role-status"
            [options]="statusOptions"
            [(value)]="form.status"
          />
        </div>
        <div>
          <label for="role-type" [class]="labelClass">Type</label>
          <zcc-multi-select inputId="role-type" [options]="typeOptions" [(value)]="form.type" />
        </div>
        <div>
          <label for="role-resource" [class]="labelClass">Resource</label>
          <zcc-multi-select
            inputId="role-resource"
            [options]="resourceOptions"
            [(value)]="form.resource"
          />
        </div>

        @if (moreFilters()) {
          <div>
            <label for="role-permission" [class]="labelClass">Permission</label>
            <zcc-multi-select
              inputId="role-permission"
              [options]="permissionOptions"
              [(value)]="form.permission"
            />
          </div>
          <div>
            <label for="role-scope" [class]="labelClass">Scope</label>
            <zcc-multi-select
              inputId="role-scope"
              [options]="scopeOptions"
              [(value)]="form.scope"
            />
          </div>
          <div>
            <label for="role-group" [class]="labelClass">Group</label>
            <zcc-multi-select
              inputId="role-group"
              [options]="groupOptions()"
              [(value)]="form.groupId"
            />
          </div>
          <div>
            <label for="role-created-by" [class]="labelClass">Created By</label>
            <zcc-user-select inputId="role-created-by" [(value)]="form.createdBy" />
          </div>
          <app-date-control label="Created From" [(value)]="form.createdFrom" />
          <app-date-control
            label="Created To"
            [minDate]="form.createdFrom || undefined"
            [(value)]="form.createdTo"
          />
          <app-date-control label="Updated From" [(value)]="form.updatedFrom" />
          <app-date-control
            label="Updated To"
            [minDate]="form.updatedFrom || undefined"
            [(value)]="form.updatedTo"
          />
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

    @if (store.loading()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4, 5]; track $index) {
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load roles"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table
        [columns]="columns"
        [rows]="store.items()"
        [rowTemplate]="rowTpl"
        [rowClickable]="true"
        (rowClick)="onRowClick($event)"
      >
        <ng-template #rowTpl let-r>
          <td class="px-4 py-3">
            <a
              [routerLink]="['/iam/roles', r.id]"
              class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              (click)="$event.stopPropagation()"
            >
              {{ r.name }}
            </a>
            @if (r.isSystem) {
              <span
                class="ml-2 rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-500 ring-1 ring-inset ring-purple-500/20"
              >
                system
              </span>
            }
          </td>
          <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{{ r.key }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ roleType(r) }}</td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="r.scope" [label]="r.scope" />
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ r.permissionCount }}</span>
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">-</span>
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
            <span class="tabular-nums">{{ r.userCount }}</span>
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip
              [value]="r.status"
              [label]="r.status === 'ACTIVE' ? 'Active' : 'Inactive'"
            />
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ date(r.updatedAt) }}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-1">
              <a
                [routerLink]="['/iam/roles', r.id]"
                [class]="btn.icon"
                title="View"
                aria-label="View role"
              >
                <i class="pi pi-eye" aria-hidden="true"></i>
              </a>
              <a
                [routerLink]="['/iam/roles', r.id]"
                [queryParams]="{ section: 'permissions' }"
                [class]="btn.icon"
                title="Manage permissions"
                aria-label="Manage permissions"
              >
                <i class="pi pi-key" aria-hidden="true"></i>
              </a>
              @if (!r.isSystem) {
                <button type="button" [class]="btn.icon" title="Clone role" aria-label="Clone role">
                  <i class="pi pi-copy" aria-hidden="true"></i>
                </button>
              }
            </div>
          </td>
        </ng-template>
      </zcc-data-table>

      <app-pagination
        class="px-1 py-3"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-shield"
        title="No roles found"
        message="Try adjusting your search or create a new role."
      />
    }
  `,
})
export class RolesListComponent {
  private readonly api = inject(IamApiService);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly labelClass = 'mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400';
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly scopeOptions = SCOPE_OPTIONS;
  protected readonly resourceOptions = RESOURCE_OPTIONS;
  protected readonly permissionOptions = PERMISSION_OPTIONS;
  protected readonly date = formatDate;
  protected form: RoleSearchForm = structuredClone(EMPTY_FORM);
  protected readonly moreFilters = signal(false);
  private readonly groups = signal<MultiSelectOption[]>([]);
  protected readonly groupOptions = computed(() => this.groups());

  readonly store = createListStore<RoleListItem>({
    filterKeys: FILTER_KEYS,
    loader: (query) => firstValueFrom(this.api.listRoles(query)).then(unwrap),
  });

  readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Role Name' },
    { key: 'key', label: 'Role Code' },
    { key: 'type', label: 'Type' },
    { key: 'scope', label: 'Scope' },
    { key: 'permissionCount', label: 'Permissions' },
    { key: 'groupCount', label: 'Groups' },
    { key: 'userCount', label: 'Users' },
    { key: 'status', label: 'Status' },
    { key: 'updatedAt', label: 'Last Updated' },
    { key: 'actions', label: 'Actions' },
  ];

  constructor() {
    firstValueFrom(this.api.listGroups({ page: 1, pageSize: 100 }))
      .then((res) => this.groups.set(res.data.data.map((g) => ({ value: g.id, label: g.name }))))
      .catch(() => this.groups.set([]));
  }

  search(): void {
    const { q, ...filters } = this.form;
    this.store.setQ(q.trim());
    this.store.setFilters(filters);
  }

  clear(): void {
    this.form = structuredClone(EMPTY_FORM);
    this.store.setFilters({});
    this.store.setQ('');
  }

  roleType(role: RoleListItem): string {
    return role.isSystem ? 'System' : 'Custom';
  }

  onRowClick(_row: RoleListItem): void {
    /* cell links navigate */
  }
}
