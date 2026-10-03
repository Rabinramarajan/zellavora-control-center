/**
 * User List Component - Displays users with search, filter, and pagination
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { SelectControl, SelectControlOption } from '@zellavoras/ui';
import { HasPermissionDirective } from '../../../../../core/rbac';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
} from '../../../../../shared/components/data-table';
import { AdminStoreService } from '../../../services';
import { User, UserSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    SelectControl,
    HasPermissionDirective,
    DataTableComponent,
    DataTableCellDirective,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  private store = inject(AdminStoreService);
  private router = inject(Router);

  readonly statusFilter = signal<string>('');
  readonly statusFilterOptions: SelectControlOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Active', label: 'Active', color: '#22c55e' },
    { value: 'Inactive', label: 'Inactive', color: '#94a3b8' },
    { value: 'Suspended', label: 'Suspended', color: '#f43f5e' },
  ];
  readonly users = this.store.users;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly filteredUsers = computed(() => {
    const status = this.statusFilter();
    return this.users().filter((user) => !status || user.statusValue === status);
  });

  readonly trackBy = (user: User) => user.userSerialId;

  readonly columns: DataTableColumn<User>[] = [
    { id: 'userLoginId', label: 'Login ID', sortKey: 'userLoginId' },
    {
      id: 'fullName',
      label: 'Full Name',
      sortKey: 'fullName',
      value: (u) => [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' '),
    },
    { id: 'emailId', label: 'Email', sortKey: 'emailId' },
    { id: 'employeeCode', label: 'Employee Code', sortKey: 'employeeCode' },
    {
      id: 'department',
      label: 'Department',
      value: (u) => u.departmentDescription ?? u.departmentValue ?? '',
    },
    {
      id: 'status',
      label: 'Status',
      sortKey: 'status',
      value: (u) => u.statusDescription ?? u.statusValue ?? '',
    },
    { id: 'actions', label: 'Actions', align: 'right' },
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
