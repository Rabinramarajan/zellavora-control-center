import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DateControl, FormInputControl } from '@zellavoras/ui';
import { firstValueFrom } from 'rxjs';
import { IamApiService, unwrap } from '../../../core/api/iam.api';
import { RoleListItem } from '../../../shared/models/iam.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_CARD, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { formatDate } from '../shared/iam-format';
import { MultiSelectComponent, MultiSelectOption } from '../shared/multi-select.component';
import {
  DataTableColumn,
  DataTableComponent,
  DataTableCellDirective,
  DataTableActionsDirective,
} from '../../../shared/components/data-table';
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
    DataTableCellDirective,
    DataTableActionsDirective,
    PaginationComponent,
    StatusChipComponent,
    EmptyStateComponent,
    MultiSelectComponent,
    UserSelectComponent,
  ],
  templateUrl: './roles-list.component.html',
  styleUrl: './roles-list.component.scss',
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

  readonly columns: DataTableColumn<unknown>[] = [
    { id: 'name', label: 'Role Name' },
    { id: 'key', label: 'Role Code' },
    { id: 'type', label: 'Type' },
    { id: 'scope', label: 'Scope' },
    { id: 'permissionCount', label: 'Permissions' },
    { id: 'groupCount', label: 'Groups' },
    { id: 'userCount', label: 'Users' },
    { id: 'status', label: 'Status' },
    { id: 'updatedAt', label: 'Last Updated' },
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
