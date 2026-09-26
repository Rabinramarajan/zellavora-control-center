import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormInputControl,
  SelectControl,
  SelectControlOption,
  selectFieldSchema,
  textFieldSchema,
} from '@zellavoras/ui';
import { AdminStoreService } from '../../../services';
import { Role } from '../../../models';

type RoleDraft = Pick<Role, 'roleName' | 'moduleValue' | 'statusValue'>;

@Component({
  selector: 'zcc-role-detail',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, SelectControl, RouterLink],
  templateUrl: './role-detail.component.html',
  styleUrl: './role-detail.component.css',
})
export class RoleDetailComponent implements OnInit {
  private store = inject(AdminStoreService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly role = signal<Role | null>(null);
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isNew = signal(true);

  readonly statusOptions: SelectControlOption[] = [
    { value: 'Active', label: 'Active', color: '#22c55e' },
    { value: 'Inactive', label: 'Inactive', color: '#94a3b8' },
  ];

  private readonly model = signal<RoleDraft>({
    roleName: '',
    moduleValue: '',
    statusValue: 'Active',
  });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.roleName, textFieldSchema());
      apply(path.statusValue, selectFieldSchema({ message: 'Select a status.' }));
    },
    { submission: { action: async () => this.save() } }
  );

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    let role: Role | null = null;
    if (id === 'new') {
      role = await this.store.createRole();
      this.isNew.set(true);
    } else if (id) {
      role = await this.store.openRole(parseInt(id));
      this.isNew.set(false);
    }
    if (!role) return;
    this.role.set(role);
    this.model.set({
      roleName: role.roleName ?? '',
      moduleValue: role.moduleValue ?? '',
      statusValue: role.statusValue || 'Active',
    });
  }

  private async save(): Promise<undefined> {
    const role = this.role();
    if (!role) return undefined;
    try {
      await this.store.saveRole({ ...role, ...this.model() });
      this.router.navigate(['/admin/roles']);
    } catch {
      // Error handling is done by the store
    }
    return undefined;
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
