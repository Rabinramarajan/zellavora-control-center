/**
 * User List Component - Displays users with search, filter, and pagination
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { AdminStoreService } from '../../../services';
import { User, UserSearchCriteria } from '../../../models';
import { SearchFilterHelper } from '../../../utils';

@Component({
  selector: 'zcc-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HasPermissionDirective],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css'
})
export class UserListComponent implements OnInit {
  private store = inject(AdminStoreService);
  private router = inject(Router);

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
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize()))
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
    this.router.navigate(['/admin/users/new']);
  }

  onView(user: User): void {
    this.router.navigate(['/admin/users', user.userSerialId]);
  }

  onEdit(user: User): void {
    this.router.navigate(['/admin/users', user.userSerialId]);
  }
}
