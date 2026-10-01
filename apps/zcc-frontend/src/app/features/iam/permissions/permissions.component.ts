import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { AppDialogService } from '../../../shared/components/dialog';
import { CatalogPermission, PermissionGroupItem } from '../../../shared/models/iam-admin.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_INPUT, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { PermissionUsageDrawerComponent } from './permission-usage-drawer.component';

const SEGMENT = {
  regex: /^[a-z][a-z0-9_-]*$/,
  message: 'Use lowercase letters, digits, - and _ (start with a letter).',
};

@Component({
  selector: 'zcc-permissions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IamPageHeaderComponent, DataTableComponent, EmptyStateComponent, PaginationComponent],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
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
