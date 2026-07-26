/**
 * User List Component - Displays users with search, filter, and pagination
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { AdminStoreService } from '../../../services';
import { User, UserSearchCriteria } from '../../../models';
import { SearchFilterHelper, PaginationHelper } from '../../../utils';

@Component({
  selector: 'zcc-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HasPermissionDirective],
  template: `
    <div class="user-list">
      <header class="page-header">
        <h1>Users</h1>
        <button
          *hasPermission="'admin:users:create'"
          class="btn btn-primary"
          (click)="onCreate()"
        >
          + New User
        </button>
      </header>

      <div class="filters-section">
        <input
          type="text"
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
          placeholder="Search by name, email, or employee code..."
          class="search-input"
        />
        <select [(ngModel)]="statusFilter" (ngModelChange)="onStatusFilterChange($event)">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Suspended">Suspended</option>
        </select>
        <button class="btn btn-secondary" (click)="onReset()">Reset</button>
      </div>

      <div class="loading" *ngIf="loading()">Loading users...</div>
      <div class="error" *ngIf="error()">{{ error() }}</div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Login ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Employee Code</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (user of filteredUsers(); track user.userSerialId) {
              <tr>
                <td>{{ user.userLoginId }}</td>
                <td>
                  <a [routerLink]="['/admin/users', user.userSerialId]">
                    {{ user.firstName }} {{ user.lastName }}
                  </a>
                </td>
                <td>{{ user.emailId }}</td>
                <td>{{ user.employeeCode || '—' }}</td>
                <td>{{ user.departmentDescription || '—' }}</td>
                <td>
                  <span [class]="'badge badge-' + (user.statusValue || 'unknown').toLowerCase()">
                    {{ user.statusDescription }}
                  </span>
                </td>
                <td class="actions">
                  <button
                    *hasPermission="'admin:users:read'"
                    class="btn btn-sm btn-ghost"
                    (click)="onView(user)"
                  >
                    View
                  </button>
                  <button
                    *hasPermission="'admin:users:update'"
                    class="btn btn-sm btn-ghost"
                    (click)="onEdit(user)"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="empty">No users found.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="pagination-section" *ngIf="totalCount() > 0">
        <div class="info">Showing {{ startIndex() + 1 }} to {{ endIndex() }} of {{ totalCount() }}</div>
        <div class="controls">
          <button (click)="onPrevPage()" [disabled]="!canPreviousPage()">← Previous</button>
          <span class="page-info">Page {{ currentPage() }} of {{ totalPages() }}</span>
          <button (click)="onNextPage()" [disabled]="!canNextPage()">Next →</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .user-list { padding: 1.5rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h1 { margin: 0; }
    .filters-section { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .search-input { flex: 1; min-width: 250px; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
    .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
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
    .badge-suspended { background: #fee2e2; color: #991b1b; }
    .actions { display: flex; gap: 0.5rem; }
    .empty { text-align: center; color: #6b7280; padding: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.875rem; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #e5e7eb; color: #111827; }
    .btn-ghost { background: transparent; color: #3b82f6; border: 1px solid #d1d5db; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .pagination-section { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
    .info { color: #6b7280; font-size: 0.875rem; }
    .controls { display: flex; gap: 1rem; align-items: center; }
    .page-info { color: #6b7280; font-size: 0.875rem; min-width: 120px; text-align: center; }
  `]
})
export class UserListComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly searchTerm = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  readonly users = this.store.users;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();

    return SearchFilterHelper.filterUsers(this.users(), {
      searchTerm: term,
      statusFilter: status
    });
  });

  readonly totalCount = computed(() => this.filteredUsers().length);
  readonly totalPages = computed(() =>
    Math.ceil(this.totalCount() / this.pageSize())
  );
  readonly startIndex = computed(() =>
    (this.currentPage() - 1) * this.pageSize()
  );
  readonly endIndex = computed(() =>
    Math.min(this.startIndex() + this.pageSize(), this.totalCount())
  );
  readonly canPreviousPage = computed(() => this.currentPage() > 1);
  readonly canNextPage = computed(() => this.currentPage() < this.totalPages());

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      const criteria: UserSearchCriteria = {
        pageSize: 100,
        pageNumber: 1,
        ascending: true,
      };
      await this.store.loadUsers(criteria);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  onReset(): void {
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.currentPage.set(1);
  }

  onPrevPage(): void {
    if (this.canPreviousPage()) {
      this.currentPage.update(p => p - 1);
    }
  }

  onNextPage(): void {
    if (this.canNextPage()) {
      this.currentPage.update(p => p + 1);
    }
  }

  onCreate(): void {
    // Navigate to new user form
  }

  onView(user: User): void {
    // Navigate to user detail
  }

  onEdit(user: User): void {
    // Navigate to user edit
  }
}
