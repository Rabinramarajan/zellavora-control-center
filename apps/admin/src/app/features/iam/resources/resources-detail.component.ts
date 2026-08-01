import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { ResourceAction, ResourceDetail } from '@shared/models/iam.model';
import {
  DetailTabsComponent,
  DetailTab,
  StatusChipComponent,
  EmptyStateComponent,
  ConfirmDialogComponent,
} from '@shared/components/iam';

@Component({
  selector: 'zcc-resources-detail',
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
    @if (resource()) {
      <div class="mb-6">
        <a
          routerLink="/iam/resources"
          class="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
          Resources
        </a>
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ resource()!.name }}
              </h1>
              <zcc-status-chip [value]="resource()!.status" [label]="resource()!.status" />
              @if (resource()!.isSystem) {
                <zcc-status-chip value="SYSTEM" label="System" tone="purple" />
              }
            </div>
            <p class="mt-1 font-mono text-sm text-gray-400">{{ resource()!.key }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
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
          @case ('overview') {
            <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Type</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ resource()!.typeLabel }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Category</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ resource()!.category ?? '—' }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Child resources</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ resource()!.childCount }}</p>
              </div>
              <div class="rounded-xl border border-gray-200 dark:border-white/10 p-4 md:col-span-2">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ resource()!.description ?? 'No description' }}
                </p>
              </div>
            </div>
          }
          @case ('actions') {
            <div class="rounded-xl border border-gray-200 dark:border-white/10">
              <div class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-4 py-3">
                <p class="text-sm font-semibold text-gray-900 dark:text-white">Actions &amp; Permissions</p>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600"
                  (click)="onAddAction()"
                >
                  <i class="pi pi-plus text-xs" aria-hidden="true"></i>
                  Add action
                </button>
              </div>
              @if (resource()!.actions.length === 0) {
                <p class="px-4 py-8 text-center text-sm text-gray-400">
                  No actions yet. Add one to auto-create its permission key.
                </p>
              } @else {
                <div class="divide-y divide-gray-100 dark:divide-white/5">
                  @for (action of resource()!.actions; track action.id) {
                    <div class="flex items-center justify-between px-4 py-3">
                      <div>
                        <p class="font-mono text-sm text-gray-900 dark:text-white">
                          {{ resource()!.key }}:{{ action.action }}
                        </p>
                        <p class="text-xs text-gray-400">
                          {{ action.permissionKey ? 'Permission: ' + action.permissionKey : 'No permission mapped' }}
                        </p>
                      </div>
                      <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs text-red-500 hover:bg-red-500/10"
                        (click)="onRemoveAction(action)"
                      >
                        <i class="pi pi-times mr-1 text-xs" aria-hidden="true"></i>
                        Remove
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        }
      </div>

      @if (confirmDelete()) {
        <zcc-confirm-dialog
          title="Delete resource?"
          [message]="'This will remove the resource and its mapped permissions. This action cannot be undone.'"
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
        icon="pi pi-database"
        title="Resource not found"
        message="It may have been deleted."
      />
    }
  `,
})
export class ResourcesDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(IamApiService);

  readonly resource = signal<ResourceDetail | null>(null);
  readonly loading = signal(true);
  readonly activeTab = signal('overview');
  readonly confirmDelete = signal(false);

  readonly tabs = (): DetailTab[] => [
    { key: 'overview', label: 'Overview', icon: 'pi pi-info-circle' },
    { key: 'actions', label: 'Actions', icon: 'pi pi-key' },
  ];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id')!;
      const res = await firstValueFrom(this.api.getResource(id));
      this.resource.set(res.data);
    } catch {
      this.resource.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async onAddAction(): Promise<void> {
    const name = window.prompt('Action name (lowercase, e.g. approve)');
    if (!name) return;
    try {
      await firstValueFrom(this.api.addResourceAction(this.resource()!.id, { action: name.trim() }));
      await this.load();
    } catch {
      /* surface via store later */
    }
  }

  async onRemoveAction(action: ResourceAction): Promise<void> {
    if (!window.confirm(`Remove action '${action.action}'? Its permission key will be deleted.`)) return;
    try {
      await firstValueFrom(this.api.removeResourceAction(this.resource()!.id, action.id));
      await this.load();
    } catch {
      /* ignore */
    }
  }

  async onDelete(): Promise<void> {
    try {
      await firstValueFrom(this.api.deleteResource(this.resource()!.id));
      await this.router.navigate(['/iam/resources']);
    } catch {
      /* ignore */
    }
  }
}
