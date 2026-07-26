import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { AdminStoreService } from '../../../services';
import { Role, RoleSearchCriteria } from '../../../models';
import { SearchFilterHelper } from '../../../utils';

@Component({
  selector: 'zcc-role-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HasPermissionDirective],
  template: `
    <div class="role-list">
      <header class="page-header">
        <h1>Roles</h1>
        <button
          *hasPermission="'admin:roles:create'"
          class="btn btn-primary"
          (click)="onCreate()"
        >
          + New Role
        </button>
      </header>

      <div class="filters-section">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
          placeholder="Search roles..."
          class="search-input"
        />
        <button class="btn btn-secondary" (click)="onReset()">Reset</button>
      </div>

      <div class="loading" *ngIf="loading()">Loading roles...</div>
      <div class="error" *ngIf="error()">{{ error() }}</div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Description</th>
              <th>Resources</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (role of filteredRoles(); track role.roleId) {
              <tr>
                <td>
                  <a [routerLink]="['/admin/roles', role.roleId]">
                    {{ role.roleName }}
                  </a>
                </td>
                <td>{{ role.moduleDescription || '—' }}</td>
                <td>{{ role.ilstRoleResource?.length || 0 }} resources</td>
                <td>
                  <span [class]="'badge ' + (role.statusValue === 'Active' ? 'badge-active' : 'badge-inactive')">
                    {{ role.statusDescription || role.statusValue }}
                  </span>
                </td>
                <td class="actions">
                  <button
                    *hasPermission="'admin:roles:read'"
                    class="btn btn-sm btn-ghost"
                    (click)="onView(role)"
                  >
                    View
                  </button>
                  <button
                    *hasPermission="'admin:roles:update'"
                    class="btn btn-sm btn-ghost"
                    (click)="onEdit(role)"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty">No roles found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .role-list { padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h1 { margin: 0; }
    .filters-section { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .search-input { flex: 1; min-width: 250px; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
    .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .loading, .error { padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
    .loading { background: #dbeafe; color: #1e40af; }
    .error { background: #fee2e2; color: #991b1b; }
    .table-wrapper { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .data-table th { background: #f9fafb; font-weight: 600; }
    .data-table a { color: #3b82f6; text-decoration: none; }
    .data-table a:hover { text-decoration: underline; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
    .badge-active { background: #dcfce7; color: #166534; }
    .badge-inactive { background: #f3f4f6; color: #374151; }
    .actions { display: flex; gap: 0.5rem; }
    .empty { text-align: center; color: #6b7280; padding: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #e5e7eb; color: #111827; }
    .btn-ghost { background: transparent; color: #3b82f6; border: 1px solid #d1d5db; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
  `]
})
export class RoleListComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly searchTerm = signal<string>('');
  readonly roles = this.store.roles;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly filteredRoles = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.roles().filter(role =>
      role.roleName.toLowerCase().includes(term) ||
      (role.moduleDescription?.toLowerCase().includes(term) || false)
    );
  });

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const criteria: RoleSearchCriteria = {
        pageSize: 100,
        pageNumber: 1,
        ascending: true,
      };
      await this.store.loadRoles(criteria);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
  }

  onReset(): void {
    this.searchTerm.set('');
  }

  onCreate(): void {
    // Navigate to new role form
  }

  onView(role: Role): void {
    // Navigate to role detail
  }

  onEdit(role: Role): void {
    // Navigate to role edit
  }
}
