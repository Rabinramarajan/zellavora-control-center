import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import {
  AppDialogService,
  DialogShellComponent,
  injectDialogData,
} from '../../../shared/components/dialog';
import {
  CatalogPermission,
  CatalogPermissionDetail,
  PermissionGroupItem,
} from '../../../shared/models/iam-admin.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  EmptyStateComponent,
  StatusChipComponent,
} from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_INPUT, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';

const SEGMENT = {
  regex: /^[a-z][a-z0-9_-]*$/,
  message: 'Use lowercase letters, digits, - and _ (start with a letter).',
};

/** Side drawer listing the roles that grant or deny a permission. */
@Component({
  selector: 'zcc-permission-usage-drawer',
  standalone: true,
  imports: [DialogShellComponent, StatusChipComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-shell [title]="data.key" subtitle="Roles using this permission">
      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"></div>
          }
        </div>
      } @else if (error()) {
        <p class="text-sm text-red-500">{{ error() }}</p>
      } @else if (detail(); as d) {
        @if (d.description) {
          <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">{{ d.description }}</p>
        }
        @if (!d.roles.length) {
          <p class="text-sm text-gray-500 dark:text-gray-400">
            No role grants this permission yet.
          </p>
        } @else {
          <ul class="divide-y divide-gray-100 dark:divide-white/5">
            @for (role of d.roles; track role.roleId) {
              <li class="flex min-h-[48px] items-center justify-between gap-3 py-2">
                <a
                  [routerLink]="['/iam/roles', role.roleId]"
                  class="min-w-0 truncate font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {{ role.roleName }}
                  <span class="ml-1 font-mono text-xs text-gray-400">{{ role.roleKey }}</span>
                </a>
                <zcc-status-chip [value]="role.effect" [label]="role.effect" />
              </li>
            }
          </ul>
        }
      }
    </app-dialog-shell>
  `,
})
export class PermissionUsageDrawerComponent {
  protected readonly data = injectDialogData<CatalogPermission>();
  protected readonly detail = signal<CatalogPermissionDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    firstValueFrom(inject(IamAdminApiService).getPermission(this.data.id))
      .then((d) => this.detail.set(d))
      .catch((err) => this.error.set(errorMessage(err, 'Could not load usage.')))
      .finally(() => this.loading.set(false));
  }
}

@Component({
  selector: 'zcc-permissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, DataTableComponent, EmptyStateComponent, PaginationComponent],
  template: `
    <zcc-iam-page-header
      title="Permissions"
      icon="pi pi-lock"
      description="The catalog of resource:action keys that roles grant. Keys are fixed once created; in-use permissions can't be deleted."
    >
      @if (canManage()) {
        <button type="button" [class]="btn.secondary" (click)="createGroup()">
          <i class="pi pi-folder-plus text-xs" aria-hidden="true"></i>
          New group
        </button>
        <button type="button" [class]="btn.primary" (click)="create()">
          <i class="pi pi-plus text-xs" aria-hidden="true"></i>
          New permission
        </button>
      }
    </zcc-iam-page-header>

    <div class="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]">
      <div>
        <label for="perm-search" class="sr-only">Search permissions</label>
        <input
          id="perm-search"
          type="search"
          placeholder="Search keys or descriptions…"
          [class]="inputClass + ' min-h-[40px]'"
          [value]="store.q()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>
      <div>
        <label for="perm-resource" class="sr-only">Filter by resource</label>
        <select
          id="perm-resource"
          [class]="inputClass + ' min-h-[40px]'"
          (change)="onResource($any($event.target).value)"
        >
          <option value="">All resources</option>
          @for (r of resources(); track r) {
            <option [value]="r" [selected]="store.filters()['resource'] === r">{{ r }}</option>
          }
        </select>
      </div>
    </div>

    @if (store.loading() && !store.hasItems()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4, 5]; track $index) {
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load permissions"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table [columns]="columns" [rows]="store.items()" [rowTemplate]="rowTpl">
        <ng-template #rowTpl let-p>
          <td class="px-4 py-3">
            <span class="font-mono text-xs font-semibold text-gray-900 dark:text-white">{{
              p.key
            }}</span>
            @if (p.isWildcard) {
              <span
                class="ml-2 rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-400 ring-1 ring-inset ring-purple-500/20"
                >wildcard</span
              >
            }
          </td>
          <td class="max-w-md px-4 py-3 text-gray-600 dark:text-gray-300">
            {{ p.description ?? '—' }}
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ p.groupName ?? '—' }}</td>
          <td class="px-4 py-3">
            <button
              type="button"
              class="min-h-[36px] rounded-md px-2 font-medium tabular-nums text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
              [attr.aria-label]="'Show roles using ' + p.key"
              (click)="showUsage(p)"
            >
              {{ p.roleCount }} {{ p.roleCount === 1 ? 'role' : 'roles' }}
            </button>
          </td>
          <td class="px-4 py-3 text-right">
            @if (canManage()) {
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  [class]="btn.icon"
                  [attr.aria-label]="'Edit ' + p.key"
                  title="Edit"
                  (click)="edit(p)"
                >
                  <i class="pi pi-pencil" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  [class]="btn.icon + ' hover:!text-red-500'"
                  [attr.aria-label]="'Delete ' + p.key"
                  [title]="deleteHint(p)"
                  [disabled]="p.isWildcard || p.roleCount > 0 || p.resourceActionCount > 0"
                  (click)="remove(p)"
                >
                  <i class="pi pi-trash" aria-hidden="true"></i>
                </button>
              </div>
            }
          </td>
        </ng-template>
      </zcc-data-table>
      <app-pagination
        class="px-1 py-3"
        entityLabel="permissions"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-lock"
        title="No permissions found"
        message="Try another search or resource filter."
      />
    }
  `,
})
export class PermissionsComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly appDialog = inject(AppDialogService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly canManage = inject(PermissionService).can('roles:manage');
  protected readonly resources = signal<string[]>([]);
  private readonly groups = signal<PermissionGroupItem[]>([]);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly columns: DataTableColumn[] = [
    { key: 'key', label: 'Key' },
    { key: 'description', label: 'Description' },
    { key: 'group', label: 'Group' },
    { key: 'usage', label: 'Used by' },
    { key: 'actions', label: '' },
  ];

  readonly store = createListStore<CatalogPermission>({
    initialPageSize: 50,
    filterKeys: ['resource'],
    loader: async (query) => {
      const list = await firstValueFrom(this.api.listPermissions(query));
      this.resources.set(list.resources);
      return list;
    },
  });

  protected deleteHint(p: CatalogPermission): string {
    if (p.isWildcard) return 'Wildcard permissions cannot be deleted';
    if (p.roleCount > 0 || p.resourceActionCount > 0) return 'In use — remove role grants first';
    return 'Delete';
  }

  protected onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(q.trim()), 300);
  }

  protected onResource(resource: string): void {
    this.store.setFilters(resource ? { resource } : {});
  }

  protected showUsage(p: CatalogPermission): void {
    this.appDialog.open(PermissionUsageDrawerComponent, { data: p, position: 'right', size: 'md' });
  }

  protected async create(): Promise<void> {
    const groupOptions = await this.groupOptions();
    const result = await this.dialogs.form({
      title: 'New permission',
      description: 'The key is built as resource:action and cannot be changed later.',
      submitText: 'Create',
      fields: [
        {
          key: 'resource',
          label: 'Resource',
          type: 'text',
          required: true,
          maxLength: 40,
          placeholder: 'e.g. invoices',
          pattern: SEGMENT,
        },
        {
          key: 'action',
          label: 'Action',
          type: 'text',
          required: true,
          maxLength: 40,
          placeholder: 'e.g. approve',
          pattern: SEGMENT,
        },
        { key: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
        {
          key: 'groupId',
          label: 'Group',
          type: 'select',
          options: groupOptions,
          placeholder: 'No group',
        },
      ],
      submit: (v) =>
        firstValueFrom(
          this.api.createPermission({
            resource: String(v['resource']),
            action: String(v['action']),
            description: (v['description'] as string) || null,
            groupId: (v['groupId'] as string) || null,
          })
        ),
    });
    if (!result) return;
    this.feedback.success(`Permission ${result['resource']}:${result['action']} created.`);
    await this.store.reload();
  }

  protected async edit(p: CatalogPermission): Promise<void> {
    const groupOptions = await this.groupOptions();
    const result = await this.dialogs.form({
      title: `Edit ${p.key}`,
      fields: [
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          maxLength: 500,
          value: p.description,
        },
        {
          key: 'groupId',
          label: 'Group',
          type: 'select',
          options: groupOptions,
          placeholder: 'No group',
          value: p.groupId,
        },
      ],
      submit: (v) =>
        firstValueFrom(
          this.api.updatePermission(p.id, {
            description: (v['description'] as string) || null,
            groupId: (v['groupId'] as string) || null,
          })
        ),
    });
    if (!result) return;
    this.feedback.success('Permission updated.');
    await this.store.reload();
  }

  protected async remove(p: CatalogPermission): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Delete permission?',
      `${p.key} will be removed from the catalog.`,
      'Delete'
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.deletePermission(p.id));
      this.feedback.success(`${p.key} deleted.`);
      await this.store.reload();
    } catch (err) {
      this.feedback.error(err);
    }
  }

  protected async createGroup(): Promise<void> {
    const result = await this.dialogs.form({
      title: 'New permission group',
      description: 'Groups organise the catalog; they do not grant anything by themselves.',
      submitText: 'Create',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 80 },
        { key: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
      ],
      submit: (v) =>
        firstValueFrom(
          this.api.createPermissionGroup({
            name: String(v['name']),
            description: (v['description'] as string) || null,
          })
        ),
    });
    if (!result) return;
    this.groups.set([]);
    this.feedback.success(`Group ${result['name']} created.`);
  }

  private async groupOptions() {
    if (!this.groups().length) {
      try {
        this.groups.set(await firstValueFrom(this.api.listPermissionGroups()));
      } catch (err) {
        this.feedback.error(err, 'Could not load permission groups.');
      }
    }
    return this.groups().map((g) => ({ label: g.name, value: g.id }));
  }
}
