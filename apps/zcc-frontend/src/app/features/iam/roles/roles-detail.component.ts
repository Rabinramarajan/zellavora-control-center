import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { RoleDetail } from '@shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
} from '@shared/components/iam';
import { AppDialogService } from '@shared/components/dialog';
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
  template: `
    @if (role()) {
      <div class="mb-6">
        <a
          routerLink="/iam/roles"
          class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
          Roles
        </a>
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ role()!.name }}</h1>
              <zcc-status-chip [value]="role()!.scope" [label]="role()!.scope" />
              <zcc-status-chip [value]="role()!.status" [label]="role()!.status" />
              @if (role()!.isSystem) {
                <zcc-status-chip value="SYSTEM" label="System" tone="purple" />
              }
            </div>
            <p class="mt-1 font-mono text-sm text-gray-400">{{ role()!.key }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-500/10"
              (click)="onCopy()"
            >
              <i class="pi pi-copy mr-1 text-xs" aria-hidden="true"></i>
              Copy
            </button>
            <button
              type="button"
              class="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-500/10"
              (click)="activeTab.set('permissions')"
            >
              <i class="pi pi-key mr-1 text-xs" aria-hidden="true"></i>
              Manage Permissions
            </button>
            <button
              type="button"
              [disabled]="role()!.isSystem"
              class="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              (click)="onDelete()"
            >
              <i class="pi pi-trash mr-1 text-xs" aria-hidden="true"></i>
              Delete
            </button>
          </div>
        </div>
      </div>

      <zcc-detail-tabs [tabs]="tabs()" [(activeKey)]="activeTab" />

      <div class="mt-5">
        @switch (activeTab()) {
          @case ('overview') {
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Role ID</p>
                <p class="mt-1 break-all font-mono text-sm text-gray-900 dark:text-white">
                  {{ role()!.id }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Role Code</p>
                <p class="mt-1 font-mono text-sm text-gray-900 dark:text-white">
                  {{ role()!.key }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Role Type</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ role()!.isSystem ? 'System' : 'Custom' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Scope</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ role()!.scope }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ role()!.status }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Assignments
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ role()!.permissionCount }} permissions · {{ role()!.userCount }} users
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 p-4 dark:border-white/10 md:col-span-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Description
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ role()!.description ?? 'No description' }}
                </p>
              </div>
            </div>
          }
          @case ('permissions') {
            <div class="mb-4 flex items-center justify-end">
              <span class="mr-3 text-xs text-gray-400 tabular-nums">
                {{ matrixCount() }} selected
              </span>
              <button
                type="button"
                class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
                (click)="savePermissions()"
              >
                Save permissions
              </button>
            </div>
            <zcc-permission-matrix
              [existing]="role()!.permissions"
              [(matrix)]="matrix"
              (change)="matrixDirty.set(true)"
            />
          }
          @case ('resources') {
            <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              <table class="min-w-full divide-y divide-gray-100 text-sm dark:divide-white/10">
                <thead
                  class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/5 dark:text-gray-400"
                >
                  <tr>
                    <th class="px-4 py-3">Resource</th>
                    <th class="px-4 py-3">Permissions</th>
                    <th class="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (resource of resources(); track resource.name) {
                    <tr>
                      <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {{ resource.name }}
                      </td>
                      <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {{ resource.count }}
                      </td>
                      <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {{ resource.actions }}
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="px-4 py-6 text-center text-sm text-gray-400">
                        No resources attached.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @case ('groups') {
            <zcc-empty-state
              icon="pi pi-sitemap"
              title="Group assignments need API support"
              message="This section should list assigned groups, scope, assigned date, actor, and remove/view actions."
            />
          }
          @case ('users') {
            <div class="rounded-xl border border-gray-200 dark:border-white/10 p-6">
              <p class="text-sm text-gray-600 dark:text-gray-300">
                <span class="font-semibold tabular-nums">{{ role()!.userCount }}</span>
                user(s) currently hold this role.
              </p>
              <p class="mt-2 text-xs text-gray-400">
                Direct versus inherited assignments should be separated once role assignment APIs
                expose the source.
              </p>
            </div>
          }
          @case ('scope') {
            <div class="rounded-xl border border-gray-200 p-6 dark:border-white/10">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Scope Type</p>
              <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {{ role()!.scope }}
              </p>
              <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
                Scope decides where the permissions apply. Branch, department, team and custom scope
                targets need backend fields before they can be edited here.
              </p>
            </div>
          }
          @case ('history') {
            <zcc-empty-state
              icon="pi pi-history"
              title="No role change requests yet"
              message="Role request history should link approval requests such as permission, scope and assignment changes."
            />
          }
          @case ('status-history') {
            <zcc-empty-state
              icon="pi pi-clock"
              title="Status history needs API support"
              message="Store actor, timestamp, reason and correlation ID for created, activated, updated and deactivated events."
            />
          }
          @case ('audit') {
            <zcc-empty-state
              icon="pi pi-shield"
              title="Audit is read-only"
              message="This section should show role creation, permission changes, assignment changes, scope changes and clone events."
            />
          }
        }
      </div>
    } @else if (loading()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3]; track $index) {
          <div class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else {
      <zcc-empty-state
        icon="pi pi-shield"
        title="Role not found"
        message="It may have been deleted."
      />
    }
  `,
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
