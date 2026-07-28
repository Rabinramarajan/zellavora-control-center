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
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.css'
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
