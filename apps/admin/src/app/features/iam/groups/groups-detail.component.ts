import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { GroupDetail } from '@shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
  ConfirmDialogComponent,
} from '@shared/components/iam';

@Component({
  selector: 'zcc-groups-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DetailTabsComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
  ],
  template: `
    @if (group()) {
      <div class="mb-6">
        <a
          routerLink="/iam/groups"
          class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
          Groups
        </a>
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ group()!.name }}</h1>
              <zcc-status-chip [value]="group()!.type" [label]="group()!.typeLabel" />
              <zcc-status-chip [value]="group()!.status" [label]="group()!.status" />
            </div>
            <p class="mt-1 font-mono text-sm text-gray-400">{{ group()!.slug }}</p>
            @if (group()!.parentName) {
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Parent: {{ group()!.parentName }}
              </p>
            }
          </div>
          <button
            type="button"
            [disabled]="group()!.isSystem"
            class="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            (click)="confirmDelete.set(true)"
          >
            <i class="pi pi-trash mr-1 text-xs" aria-hidden="true"></i>
            Delete
          </button>
        </div>
      </div>

      <zcc-detail-tabs [tabs]="tabs()" [(activeKey)]="activeTab" />

      <div class="mt-5">
        @switch (activeTab()) {
          @case ('members') {
            <div class="mb-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-600"
                (click)="onAddMember()"
              >
                <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                Add member
              </button>
            </div>
            @if (group()!.members.length === 0) {
              <p class="py-8 text-center text-sm text-gray-400">No members yet.</p>
            } @else {
              <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                <div class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (member of group()!.members; track member.userId) {
                    <div class="flex items-center justify-between px-4 py-3">
                      <div class="flex items-center gap-3">
                        <div
                          class="flex size-9 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-semibold text-indigo-500"
                        >
                          {{ initials(member.fullName) }}
                        </div>
                        <div>
                          <p class="text-sm font-medium text-gray-900 dark:text-white">
                            {{ member.fullName ?? member.email }}
                          </p>
                          <p class="text-xs text-gray-400">{{ member.email }}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        (click)="onRemoveMember(member.userId)"
                      >
                        Remove
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          }
          @case ('roles') {
            <div class="mb-4 flex justify-end">
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-600"
                (click)="onAddRole()"
              >
                <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                Add role
              </button>
            </div>
            @if (group()!.roles.length === 0) {
              <p class="py-8 text-center text-sm text-gray-400">
                No roles attached. Members inherit these roles.
              </p>
            } @else {
              <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                <div class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (gr of group()!.roles; track gr.id) {
                    <div class="flex items-center justify-between px-4 py-3">
                      <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ gr.roleName }}</p>
                        <p class="font-mono text-xs text-gray-400">{{ gr.roleKey }}</p>
                      </div>
                      <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        (click)="onRemoveRole(gr.roleId)"
                      >
                        Remove
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          }
          @case ('children') {
            @if (group()!.children.length === 0) {
              <p class="py-8 text-center text-sm text-gray-400">No child groups.</p>
            } @else {
              <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                <div class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (child of group()!.children; track child.id) {
                    <a
                      [routerLink]="['/iam/groups', child.id]"
                      class="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ child.name }}</p>
                      <zcc-status-chip [value]="child.type" [label]="child.type" />
                    </a>
                  }
                </div>
              </div>
            }
          }
          @case ('overview') {
            <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</p>
              <p class="mt-1 text-sm text-gray-900 dark:text-white">
                {{ group()!.description ?? 'No description' }}
              </p>
            </div>
          }
        }
      </div>

      @if (confirmDelete()) {
        <zcc-confirm-dialog
          title="Delete group?"
          [message]="'This will remove the group, its memberships and attached roles.'"
          confirmLabel="Delete"
          (confirm)="onDelete()"
          (cancel)="confirmDelete.set(false)"
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
        icon="pi pi-sitemap"
        title="Group not found"
        message="It may have been deleted."
      />
    }
  `,
})
export class GroupsDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);

  readonly group = signal<GroupDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('members');
  readonly confirmDelete = signal(false);

  readonly tabs = (): DetailTab[] => [
    { key: 'members', label: 'Members', icon: 'pi pi-users' },
    { key: 'roles', label: 'Roles', icon: 'pi pi-shield' },
    { key: 'children', label: 'Children', icon: 'pi pi-sitemap' },
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
  ];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getGroup(id));
      this.group.set(res.data);
    } catch {
      this.group.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  initials(name: string | null): string {
    if (!name) return '?';
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  async onAddMember(): Promise<void> {
    const email = window.prompt('Member email (must match an existing user)');
    if (!email) return;
    // Resolve email → user id is out of scope here; surface a friendly message.
    window.alert('Add members by user id from the Users list — full picker arrives with Module 1.');
  }

  async onRemoveMember(userId: string): Promise<void> {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      const res = await firstValueFrom(this.api.removeGroupMember(this.group()!.id, userId));
      this.group.set(res.data);
    } catch {
      /* ignore */
    }
  }

  async onAddRole(): Promise<void> {
    window.alert('Role picker arrives with the Roles integration.');
  }

  async onRemoveRole(roleId: string): Promise<void> {
    const current = this.group()!;
    const next = current.roles.filter((r) => r.roleId !== roleId).map((r) => r.roleId);
    try {
      const res = await firstValueFrom(
        this.api.setGroupRoles(current.id, { roleIds: next, mode: 'replace' })
      );
      this.group.set(res.data);
    } catch {
      /* ignore */
    }
  }

  async onDelete(): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteGroup(this.group()!.id));
      await this.router.navigate(['/iam/groups']);
    } catch {
      /* ignore */
    }
  }
}
