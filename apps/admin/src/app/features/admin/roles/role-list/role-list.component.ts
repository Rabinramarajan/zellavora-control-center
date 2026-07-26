/**
 * Roles management page — full example wiring directives, services,
 * signals, and HTTP together.
 *
 * This is the "list" view. Edit/clone flows live in separate components.
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RbacService, HasPermissionDirective, Role } from '@core/rbac';

@Component({
  selector: 'zcc-role-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HasPermissionDirective],
  template: `
    <div class="role-list">
      <header class="page-header">
        <h1>Roles</h1>
        <button
          *hasPermission="'system:rbac:write'"
          class="btn btn-primary"
          (click)="onCreate()"
        >
          + New Role
        </button>
      </header>

      <div class="filters">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
          placeholder="Search roles…"
          class="search-input"
        />
        <select [(ngModel)]="sortBy" (ngModelChange)="onSort($event)">
          <option value="level">Level</option>
          <option value="label">Name</option>
          <option value="isSystem">System</option>
        </select>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th></th>
            <th>Role</th>
            <th>Level</th>
            <th>Type</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (role of filtered(); track role.id) {
            <tr>
              <td>
                <span class="chip" [style.background]="role.color || '#64748b'"></span>
              </td>
              <td>
                <a [routerLink]="['/admin/roles', role.id]">{{ role.label }}</a>
                <div class="role-key">{{ role.key }}</div>
              </td>
              <td>{{ role.level }}</td>
              <td>
                @if (role.isSystem) {
                  <span class="badge badge-system">system</span>
                } @else {
                  <span class="badge badge-custom">custom</span>
                }
              </td>
              <td>{{ role.permissions?.length || '—' }}</td>
              <td>
                <button
                  *hasPermission="'system:rbac:write'"
                  class="btn btn-ghost"
                  [disabled]="role.isSystem"
                  (click)="onClone(role)"
                >Clone</button>
                <button
                  *hasPermission="'system:rbac:write'"
                  class="btn btn-ghost btn-danger"
                  [disabled]="role.isSystem"
                  (click)="onDelete(role)"
                >Delete</button>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="6" class="empty">No roles found.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .role-list { padding: 1.5rem; }
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem;
    }
    .filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .search-input { flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .chip { display: inline-block; width: 12px; height: 12px; border-radius: 50%; }
    .role-key { font-size: 0.75rem; color: #6b7280; }
    .badge {
      display: inline-block; padding: 0.125rem 0.5rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 500;
    }
    .badge-system { background: #fee2e2; color: #991b1b; }
    .badge-custom { background: #dbeafe; color: #1e40af; }
    .empty { text-align: center; color: #6b7280; padding: 2rem; }
  `]
})
export class RoleListComponent implements OnInit {
  private rbac = inject(RbacService);

  readonly roles = signal<Role[]>([]);
  readonly searchTerm = signal<string>('');
  readonly sortBy = signal<'level' | 'label' | 'isSystem'>('level');

  readonly filtered = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const all = this.roles();
    const filtered = term
      ? all.filter(r =>
          r.label.toLowerCase().includes(term) ||
          r.key.toLowerCase().includes(term) ||
          r.description?.toLowerCase().includes(term)
        )
      : all;
    const sorted = [...filtered];
    switch (this.sortBy()) {
      case 'level':   sorted.sort((a, b) => b.level - a.level); break;
      case 'label':   sorted.sort((a, b) => a.label.localeCompare(b.label)); break;
      case 'isSystem': sorted.sort((a, b) => Number(b.isSystem) - Number(a.isSystem)); break;
    }
    return sorted;
  });

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.roles.set(await this.rbac.listRoles());
  }

  onSearch(term: string): void { this.searchTerm.set(term); }
  onSort(by: 'level' | 'label' | 'isSystem'): void { this.sortBy.set(by); }

  onCreate(): void {
    // Navigate to editor with empty form
    // this.router.navigate(['/admin/roles', 'new']);
  }

  onClone(role: Role): void {
    // const key = prompt('Key for the cloned role?');
    // const label = prompt('Label?');
    // if (key && label) await this.rbac.cloneRole(role.id, key, label);
    // this.load();
  }

  async onDelete(role: Role): Promise<void> {
    if (!confirm(`Delete role "${role.label}"?`)) return;
    await this.rbac.deleteRole(role.id);
    await this.load();
  }
}
