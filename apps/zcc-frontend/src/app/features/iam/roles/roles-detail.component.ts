import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '../../../core/api/iam.api';
import { RoleDetail } from '../../../shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
} from '../../../shared/components/iam';
import { AppDialogService } from '../../../shared/components/dialog';
import { PermissionMatrixComponent, PermissionRow } from './permission-matrix.component';

@Component({
  selector: 'zcc-roles-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    DetailTabsComponent,
    StatusChipComponent,
    EmptyStateComponent,
    PermissionMatrixComponent,
  ],
  templateUrl: './roles-detail.component.html',
  styleUrl: './roles-detail.component.scss',
})
export class RolesDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);
  private readonly dialog = inject(AppDialogService);

  readonly role = signal<RoleDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('overview');
  readonly matrixDirty = signal(false);
  readonly matrix = signal<PermissionRow[]>([]);

  readonly tabs = (): DetailTab[] => [
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
    { key: 'permissions', label: 'Permissions', icon: 'pi pi-key' },
    { key: 'resources', label: 'Resources', icon: 'pi pi-th-large' },
    { key: 'groups', label: 'Groups', icon: 'pi pi-sitemap' },
    { key: 'users', label: 'Users', icon: 'pi pi-users' },
    { key: 'scope', label: 'Scope', icon: 'pi pi-map-marker' },
    { key: 'history', label: 'Change History', icon: 'pi pi-history' },
    { key: 'status-history', label: 'Status History', icon: 'pi pi-clock' },
    { key: 'audit', label: 'Audit', icon: 'pi pi-shield' },
  ];

  readonly matrixCount = computed(() => this.matrix().filter((r) => r.effect !== null).length);
  readonly resources = computed(() => {
    const byResource = new Map<string, { name: string; count: number; actions: string[] }>();
    for (const permission of this.role()?.permissions ?? []) {
      const name = permission.resource ?? 'Ungrouped';
      const row = byResource.get(name) ?? { name, count: 0, actions: [] };
      row.count += 1;
      if (permission.action) row.actions.push(permission.action);
      byResource.set(name, row);
    }
    return [...byResource.values()].map((r) => ({
      ...r,
      actions: r.actions.length ? r.actions.join(', ') : '-',
    }));
  });

  constructor() {
    const section = this.route.snapshot.queryParamMap.get('section');
    if (section) this.activeTab.set(section);
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getRole(id));
      this.role.set(res.data);
      this.matrixDirty.set(false);
    } catch {
      this.role.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async savePermissions(): Promise<void> {
    if (!this.role()) return;
    const entries = this.matrix()
      .filter((r) => r.effect !== null)
      .map((r) => ({ permissionId: r.permissionId, effect: r.effect! }));
    try {
      await firstValueFrom(
        this.api.setRolePermissions(this.role()!.id, { permissions: entries, mode: 'replace' })
      );
      this.matrixDirty.set(false);
      await this.load();
    } catch {
      /* surface via toast later */
    }
  }

  async onCopy(): Promise<void> {
    const name = await firstValueFrom(
      this.dialog.prompt({
        title: 'Copy role',
        message: 'Create a new role with the same permissions under a new name.',
        label: 'New role name',
        initialValue: `${this.role()!.name} (copy)`,
        required: true,
        confirmText: 'Copy',
      })
    );
    if (!name) return;
    try {
      await firstValueFrom(
        this.api.copyRole(this.role()!.id, { name: name.trim(), includePermissions: true })
      );
      await this.router.navigate(['/iam/roles']);
    } catch {
      /* ignore */
    }
  }

  async onDelete(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete role?',
        message:
          'This will revoke the role from all users and groups. This action cannot be undone.',
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteRole(this.role()!.id));
      await this.router.navigate(['/iam/roles']);
    } catch {
      /* ignore */
    }
  }
}
