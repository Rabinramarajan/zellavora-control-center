/**
 * User List Component - Displays users with search, filter, and pagination
 */
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '@core/rbac';
import { Table, ColumnDef, CellDirective } from '@shared/components/table/table';
import { AdminStoreService } from '../../../services';
import { User, UserSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HasPermissionDirective, Table, CellDirective],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css'
})
export class UserListComponent implements OnInit {
  private store = inject(AdminStoreService);
  private router = inject(Router);

  readonly statusFilter = signal<string>('');
  readonly users = this.store.users;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly filteredUsers = computed(() => {
    const status = this.statusFilter();
    return this.users().filter(user => !status || user.statusValue === status);
  });

  readonly trackBy = (user: User) => user.userSerialId;

  readonly columns: ColumnDef<User>[] = [
    { key: 'userLoginId', header: 'Login ID', sortable: true },
    { key: 'fullName', header: 'Full Name', sortable: true, value: (u) => [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ') },
    { key: 'emailId', header: 'Email', sortable: true },
    { key: 'employeeCode', header: 'Employee Code', sortable: true },
    { key: 'department', header: 'Department', value: (u) => u.departmentDescription ?? u.departmentValue ?? '' },
    { key: 'status', header: 'Status', sortable: true, value: (u) => u.statusDescription ?? u.statusValue ?? '' },
    { key: 'actions', header: 'Actions', align: 'right' },
  ];

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
    } catch {
      // Error handling is done by the store
    }
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
  }

  onReset(): void {
    this.statusFilter.set('');
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
