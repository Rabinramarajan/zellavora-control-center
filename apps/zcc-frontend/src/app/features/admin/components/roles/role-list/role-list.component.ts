import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HasPermissionDirective } from '../../../../../core/rbac';
import { Table, ColumnDef, CellDirective } from '../../../../../shared/components/table/table';
import { AdminStoreService } from '../../../services';
import { Role, RoleSearchCriteria } from '../../../models';

@Component({
  selector: 'zcc-role-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, FormsModule, HasPermissionDirective, Table, CellDirective],
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.scss',
})
export class RoleListComponent implements OnInit {
  private store = inject(AdminStoreService);

  readonly roles = this.store.roles;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly trackBy = (role: Role) => role.roleId;

  readonly columns: ColumnDef<Role>[] = [
    { key: 'roleName', header: 'Role Name', sortable: true },
    { key: 'moduleDescription', header: 'Description', value: (r) => r.moduleDescription ?? '' },
    {
      key: 'resources',
      header: 'Resources',
      align: 'right',
      value: (r) => r.ilstRoleResource?.length ?? 0,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      value: (r) => r.statusDescription ?? r.statusValue ?? '',
    },
    { key: 'actions', header: 'Actions', align: 'right' },
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
