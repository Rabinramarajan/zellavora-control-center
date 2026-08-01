import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { RoleDetail } from '@shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
  ConfirmDialogComponent,
} from '@shared/components/iam';
import { PermissionMatrixComponent, PermissionRow } from './permission-matrix.component';

@Component({
  selector: 'zcc-roles-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DetailTabsComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
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
              (click)="confirmCopy.set(true)"
            >
              <i class="pi pi-copy mr-1 text-xs" aria-hidden="true"></i>
              Copy
            </button>
            <button
              type="button"
              [disabled]="role()!.isSystem"
              class="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              (click)="confirmDelete.set(true)"
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
          @case ('users') {
            <div class="rounded-xl border border-gray-200 dark:border-white/10 p-6">
              <p class="text-sm text-gray-600 dark:text-gray-300">
                <span class="font-semibold tabular-nums">{{ role()!.userCount }}</span>
                user(s) currently hold this role.
              </p>
            </div>
          }
          @case ('overview') {
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Key</p>
                <p class="mt-1 font-mono text-sm text-gray-900 dark:text-white">{{ role()!.key }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Organization</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ role()!.organizationId ?? 'Platform-wide' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ role()!.description ?? 'No description' }}
                </p>
              </div>
            </div>
          }
        }
      </div>

      @if (confirmDelete()) {
        <zcc-confirm-dialog
          title="Delete role?"
          [message]="'This will revoke the role from all users and groups. This action cannot be undone.'"
          confirmLabel="Delete"
          (confirm)="onDelete()"
          (cancel)="confirmDelete.set(false)"
        />
      }
      @if (confirmCopy()) {
        <zcc-confirm-dialog
          title="Copy role"
          message="Create a new role with the same permissions under a new name?"
          confirmLabel="Copy"
          (confirm)="onCopy()"
          (cancel)="confirmCopy.set(false)"
        />
      }
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

  readonly role = signal<RoleDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('permissions');
  readonly confirmDelete = signal(false);
  readonly confirmCopy = signal(false);
  readonly matrixDirty = signal(false);
  readonly matrix = signal<PermissionRow[]>([]);

  readonly tabs = (): DetailTab[] => [
    { key: 'permissions', label: 'Permissions', icon: 'pi pi-key' },
    { key: 'users', label: 'Users', icon: 'pi pi-users' },
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
  ];

  readonly matrixCount = computed(
    () => this.matrix().filter((r) => r.effect !== null).length
  );

  constructor() {
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
    const name = window.prompt('Name for the copied role');
    if (!name) return;
    try {
      await firstValueFrom(this.api.copyRole(this.role()!.id, { name: name.trim(), includePermissions: true }));
      await this.router.navigate(['/iam/roles']);
    } catch {
      /* ignore */
    }
  }

  async onDelete(): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteRole(this.role()!.id));
      await this.router.navigate(['/iam/roles']);
    } catch {
      /* ignore */
    }
  }
}
