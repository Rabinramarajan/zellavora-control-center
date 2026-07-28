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
  templateUrl: './role-list.component.html',
  styleUrl: './role-list.component.css'
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
