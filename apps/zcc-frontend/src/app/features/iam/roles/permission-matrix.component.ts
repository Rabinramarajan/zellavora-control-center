import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { FormInputControl } from '@zellavoras/ui';
import { firstValueFrom } from 'rxjs';
import { IamApiService } from '../../../core/api/iam.api';
import { PermissionEffect, RolePermission } from '../../../shared/models/iam.model';

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
  imports: [FormInputControl],
  templateUrl: './permission-matrix.component.html',
  styleUrl: './permission-matrix.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionMatrixComponent {
  private readonly api = inject(IamApiService);

  /** Existing granted permissions (from the role detail). */
  readonly existing = input<RolePermission[]>([]);
  /** Two-way model of the full matrix as the user edits it. */
  readonly matrix = model<PermissionRow[]>([]);
  readonly change = output<void>();

  private readonly loaded = signal(false);
  readonly loading = computed(() => this.matrix().length === 0 && !this.loaded());
  readonly query = signal('');

  constructor() {
    void this.loadAll();
  }

  private async loadAll(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.listAllPermissions());
      const existing = this.existing();
      this.matrix.set(
        res.data.map((p) => ({
          permissionId: p.id,
          key: p.key,
          name: p.name,
          resource: p.resource ?? '',
          action: p.action ?? '',
          effect: existing.find((e) => e.permissionId === p.id)?.effect ?? null,
        }))
      );
    } catch {
      this.matrix.set([]);
    } finally {
      this.loaded.set(true);
    }
  }

  readonly groups = computed(() => {
    const term = this.query().trim().toLowerCase();
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
    const next = row.effect === effect ? null : effect;
    this.matrix.update((rows) =>
      rows.map((r) => (r.permissionId === row.permissionId ? { ...r, effect: next } : r))
    );
    this.change.emit();
  }
}
