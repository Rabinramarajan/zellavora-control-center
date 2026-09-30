import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { IamUserDetail } from '@shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
} from '@shared/components/iam';
import { AppDialogService } from '@shared/components/dialog';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';

@Component({
  selector: 'zcc-users-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, DetailTabsComponent, StatusChipComponent, EmptyStateComponent],
  template: `
    @if (user()) {
      <div class="mb-6">
        <a
          routerLink="/iam/users"
          class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
          Users
        </a>
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div
              class="flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-xl font-bold text-indigo-500"
            >
              {{ initials(user()!.fullName) }}
            </div>
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                  {{ user()!.fullName }}
                </h1>
                <zcc-status-chip [value]="user()!.status" [label]="user()!.statusLabel" />
                @if (user()!.isAccountLocked) {
                  <zcc-status-chip value="LOCKED" label="Account locked" tone="red" />
                }
              </div>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ user()!.email }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              [class]="
                user()!.isAccountLocked
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'border border-red-500/30 text-red-500 hover:bg-red-500/10'
              "
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
              (click)="toggleLock()"
            >
              <i
                class="pi mr-1 text-xs"
                [class.pi-lock]="!user()!.isAccountLocked"
                [class.pi-unlock]="user()!.isAccountLocked"
                aria-hidden="true"
              ></i>
              {{ user()!.isAccountLocked ? 'Unlock' : 'Lock' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
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
          @case ('roles') {
            <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              <div
                class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-4 py-3"
              >
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  Assigned roles ({{ user()!.roles.length }})
                </p>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
                  (click)="onAddRole()"
                >
                  <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                  Assign role
                </button>
              </div>
              @if (user()!.roles.length === 0) {
                <p class="px-4 py-8 text-center text-sm text-gray-400">No roles assigned.</p>
              } @else {
                <div class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (r of user()!.roles; track r.id) {
                    <div class="flex items-center justify-between px-4 py-3">
                      <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ r.roleName }}
                        </p>
                        <p class="font-mono text-xs text-gray-400">{{ r.roleKey }}</p>
                      </div>
                      <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        (click)="onRemoveRole(r.roleId)"
                      >
                        Remove
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @case ('groups') {
            <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              <div
                class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-4 py-3"
              >
                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                  Group memberships ({{ user()!.groups.length }})
                </p>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
                  (click)="onAddGroup()"
                >
                  <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                  Join group
                </button>
              </div>
              @if (user()!.groups.length === 0) {
                <p class="px-4 py-8 text-center text-sm text-gray-400">No group memberships.</p>
              } @else {
                <div class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (g of user()!.groups; track g.id) {
                    <div class="flex items-center justify-between px-4 py-3">
                      <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white">
                          {{ g.groupName }}
                        </p>
                        <p class="font-mono text-xs text-gray-400">{{ g.groupSlug }}</p>
                      </div>
                      <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        (click)="onRemoveGroup(g.groupId)"
                      >
                        Leave
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @case ('overview') {
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Username</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ user()!.username ?? '—' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Department
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ user()!.department ?? '—' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Job title</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ user()!.jobTitle ?? '—' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Last login
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ user()!.lastLoginDatetime ? formatDate(user()!.lastLoginDatetime!) : 'Never' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email verified
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ user()!.emailVerified ? 'Yes' : 'No' }}
                </p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Mobile</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ user()!.mobile ?? '—' }}
                </p>
              </div>
            </div>
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
        icon="pi pi-users"
        title="User not found"
        message="It may have been deleted."
      />
    }
  `,
})
export class UsersDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  readonly user = signal<IamUserDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('roles');

  readonly tabs = (): DetailTab[] => [
    { key: 'roles', label: 'Roles', icon: 'pi pi-shield' },
    { key: 'groups', label: 'Groups', icon: 'pi pi-sitemap' },
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
  ];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getIamUser(id));
      this.user.set(res.data);
    } catch {
      this.user.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async toggleLock(): Promise<void> {
    const u = this.user()!;
    try {
      const res = u.isAccountLocked
        ? await firstValueFrom(this.api.unlockIamUser(u.id))
        : await firstValueFrom(this.api.lockIamUser(u.id, 'Admin action'));
      this.user.set(res.data);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  async onAddRole(): Promise<void> {
    const u = this.user()!;
    await this.dialogs.pick({
      title: `Assign roles to ${u.fullName}`,
      searchPlaceholder: 'Search roles…',
      excludeIds: u.roles.map((r) => r.roleId),
      search: this.dialogs.searchRoles,
      submit: async (roleIds) => {
        const res = await firstValueFrom(this.api.setIamUserRoles(u.id, { roleIds, mode: 'merge' }));
        this.user.set(res.data);
        this.feedback.success(`${roleIds.length} role(s) assigned.`);
      },
    });
  }

  async onRemoveRole(roleId: string): Promise<void> {
    const u = this.user()!;
    const next = u.roles.filter((r) => r.roleId !== roleId).map((r) => r.roleId);
    try {
      const res = await firstValueFrom(
        this.api.setIamUserRoles(u.id, { roleIds: next, mode: 'replace' })
      );
      this.user.set(res.data);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  async onAddGroup(): Promise<void> {
    const u = this.user()!;
    await this.dialogs.pick({
      title: `Add ${u.fullName} to groups`,
      searchPlaceholder: 'Search groups…',
      excludeIds: u.groups.map((g) => g.groupId),
      search: this.dialogs.searchGroups,
      submit: async (groupIds) => {
        const res = await firstValueFrom(this.api.setIamUserGroups(u.id, { groupIds, mode: 'merge' }));
        this.user.set(res.data);
        this.feedback.success(`Added to ${groupIds.length} group(s).`);
      },
    });
  }

  async onRemoveGroup(groupId: string): Promise<void> {
    const u = this.user()!;
    const next = u.groups.filter((g) => g.groupId !== groupId).map((g) => g.groupId);
    try {
      const res = await firstValueFrom(
        this.api.setIamUserGroups(u.id, { groupIds: next, mode: 'replace' })
      );
      this.user.set(res.data);
    } catch (err) {
      this.feedback.error(err);
    }
  }

  async onDelete(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete user?',
        message: 'This will remove the user and their assignments. This action cannot be undone.',
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteIamUser(this.user()!.id));
      await this.router.navigate(['/iam/users']);
    } catch (err) {
      this.feedback.error(err);
    }
  }
}
