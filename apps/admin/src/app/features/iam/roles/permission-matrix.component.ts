import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormInputControl } from '@zellavoras/ui';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '@core/api/iam.api';
import { PermissionEffect, RolePermission } from '@shared/models/iam.model';

export interface PermissionRow {
  permissionId: string;
  key: string;
  name: string;
  resource: string;
  action: string;
  effect: PermissionEffect | null;
}

/**
 * PermissionMatrixComponent — a filterable grid of every permission key,
 * grouped by resource, with allow/deny toggle per row. Binds the effective
 * matrix via `permissions` model so the parent can read the full selection.
 */
@Component({
  selector: 'zcc-permission-matrix',
  standalone: true,
  imports: [CommonModule, FormInputControl],
  template: `
    <div class="space-y-4">
      <app-form-input-control icon="search" placeholder="Filter permissions…" [(value)]="query" />

      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <div class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"></div>
          }
        </div>
      } @else {
        @for (group of groups(); track group.resource) {
          <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
            <div class="flex items-center justify-between bg-gray-50/80 dark:bg-white/5 px-4 py-2">
              <p
                class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {{ group.resource || 'ungrouped' }}
              </p>
              <span class="text-[11px] text-gray-400 tabular-nums">{{ group.rows.length }}</span>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-white/5">
              @for (row of group.rows; track row.permissionId) {
                <div class="flex items-center justify-between px-4 py-2.5">
                  <div class="min-w-0">
                    <p class="font-mono text-xs text-gray-900 dark:text-white">{{ row.key }}</p>
                    <p class="truncate text-xs text-gray-400">{{ row.name }}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      [class]="
                        row.effect === 'allow'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                      "
                      class="rounded-l-lg px-2.5 py-1 text-xs font-medium transition-colors"
                      (click)="toggle(row, 'allow')"
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      [class]="
                        row.effect === 'deny'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                      "
                      class="rounded-r-lg px-2.5 py-1 text-xs font-medium transition-colors"
                      (click)="toggle(row, 'deny')"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class PermissionMatrixComponent {
  private readonly api = inject(IamApiService);

  /** Existing granted permissions (from the role detail). */
  readonly existing = input<RolePermission[]>([]);
  /** Two-way model of the full matrix as the user edits it. */
  readonly matrix = model<PermissionRow[]>([]);
  readonly change = output<void>();

  readonly loading = computed(() => this.matrix().length === 0 && !this._loaded);
  private _loaded = false;
  readonly query = signal('');

  private allRows: PermissionRow[] = [];

  constructor() {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.listAllPermissions());
      this.allRows = res.data.map((p) => ({
        permissionId: p.id,
        key: p.key,
        name: p.name,
        resource: p.resource ?? '',
        action: p.action ?? '',
        effect: null,
      }));
      // Overlay existing grants.
      for (const row of this.allRows) {
        const grant = this.existing().find((e) => e.permissionId === row.permissionId);
        if (grant) row.effect = grant.effect;
      }
      this._loaded = true;
      this.matrix.set([...this.allRows]);
    } catch {
      this._loaded = true;
      this.matrix.set([]);
    }
  }

  readonly groups = computed(() => {
    const term = this.query().trim().toLowerCase();
    // `matrix` is reset to the full row list on load and on every toggle.
    const all = this.matrix();
    const rows = term
      ? all.filter(
          (r) =>
            r.key.toLowerCase().includes(term) ||
            r.name.toLowerCase().includes(term) ||
            r.resource.toLowerCase().includes(term)
        )
      : all;

    const byResource = new Map<string, PermissionRow[]>();
    for (const row of rows) {
      const list = byResource.get(row.resource) ?? [];
      list.push(row);
      byResource.set(row.resource, list);
    }
    return [...byResource.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resource, rows]) => ({ resource, rows }));
  });

  toggle(row: PermissionRow, effect: PermissionEffect): void {
    row.effect = row.effect === effect ? null : effect;
    this.matrix.set([...this.allRows]);
    this.change.emit();
  }
}
