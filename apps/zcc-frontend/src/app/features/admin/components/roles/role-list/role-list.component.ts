import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../../../core/rbac';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
} from '../../../../../shared/components/data-table';
import { AdminStoreService } from '../../../services';
import { Role, RoleSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-role-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    HasPermissionDirective,
    DataTableComponent,
    DataTableCellDirective,
  ],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly roles = this.store.roles;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly trackBy = (role: Role) => role.roleId;

  readonly columns: DataTableColumn<Role>[] = [
    { id: 'roleName', label: 'Role Name', sortKey: 'roleName' },
    { id: 'moduleDescription', label: 'Description', value: (r) => r.moduleDescription ?? '' },
    {
      id: 'resources',
      label: 'Resources',
      align: 'right',
      value: (r) => r.ilstRoleResource?.length ?? 0,
    },
    {
      id: 'status',
      label: 'Status',
      sortKey: 'status',
      value: (r) => r.statusDescription ?? r.statusValue ?? '',
    },
    { id: 'actions', label: 'Actions', align: 'right' },
  ];

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
    } catch {
      // Error handling is done by the store
    }
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
