import { Component, computed, inject, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <div class="relative">
        <i
          class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400"
          aria-hidden="true"
        ></i>
        <input
          type="text"
          [(ngModel)]="query"
          placeholder="Filter permissions…"
          class="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white/10 dark:bg-black/20 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      @if (loading()) {
        <div class="space-y-2">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <div class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5"></div>
          }
        </div>
      } @else {
        @for (group of groups(); track group.resource) {
          <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
            <div
              class="flex items-center justify-between bg-gray-50/80 dark:bg-white/5 px-4 py-2"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
  query = '';

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
    const term = this.query.trim().toLowerCase();
    const rows = term
      ? this.allRows.filter(
          (r) =>
            r.key.toLowerCase().includes(term) ||
            r.name.toLowerCase().includes(term) ||
            r.resource.toLowerCase().includes(term)
        )
      : this.allRows;

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
