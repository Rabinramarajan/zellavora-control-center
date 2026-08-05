import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminStoreService } from '../../../services';
import { Role } from '../../../models';

@Component({
  selector: 'zcc-role-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './role-detail.component.html',
  styleUrl: './role-detail.component.css'
})
export class RoleDetailComponent implements OnInit {
  private store = inject(AdminStoreService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly role = signal<Role | null>(null);
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isNew = signal(true);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new') {
      const newRole = await this.store.createRole();
      this.role.set(newRole);
      this.isNew.set(true);
    } else if (id) {
      const role = await this.store.openRole(parseInt(id));
      this.role.set(role);
      this.isNew.set(false);
    }
  }

  async onSave(): Promise<void> {
    if (!this.role()) return;
    try {
      await this.store.saveRole(this.role()!);
      this.router.navigate(['/admin/roles']);
    } catch {
      // Error handling is done by the store
    }
  }

  async onDelete(): Promise<void> {
    if (!this.role() || !confirm('Are you sure?')) return;
    try {
      await this.store.deleteRole(this.role()!.roleId);
      this.router.navigate(['/admin/roles']);
    } catch {
      // Error handling is done by the store
    }
  }
}
