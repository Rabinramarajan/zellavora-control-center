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
  template: `
    <div class="role-detail">
      <header class="page-header">
        <a routerLink="/admin/roles" class="back-link">← Back to Roles</a>
        <h1>{{ isNew() ? 'New Role' : 'Edit Role' }}</h1>
      </header>

      <div class="loading" *ngIf="loading()">Loading...</div>
      <div class="error" *ngIf="error()">{{ error() }}</div>

      <form *ngIf="role() && !loading()" (ngSubmit)="onSave()" class="form">
        <fieldset class="form-group">
          <legend>Role Information</legend>
          <div class="form-row">
            <div class="form-field">
              <label>Role Name</label>
              <input type="text" [(ngModel)]="role()!.roleName" name="roleName" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>Description</label>
              <textarea [(ngModel)]="role()!.roleDescription" name="description" rows="3"></textarea>
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>
                <input type="checkbox" [(ngModel)]="role()!.roleActive" name="active" />
                Active
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset class="form-group" *ngIf="role()!.roleResources && role()!.roleResources!.length > 0">
          <legend>Resources</legend>
          <div class="resource-list">
            @for (resource of role()!.roleResources!; track resource.resourceId) {
              <div class="resource-item">
                <label>
                  <input type="checkbox" [checked]="true" />
                  {{ resource.resourceName }}
                </label>
              </div>
            }
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          <a routerLink="/admin/roles" class="btn btn-secondary">Cancel</a>
          <button
            type="button"
            class="btn btn-danger"
            (click)="onDelete()"
            *ngIf="!isNew()"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .role-detail { padding: 1.5rem; }
    .page-header { margin-bottom: 2rem; }
    .back-link { color: #3b82f6; text-decoration: none; font-size: 0.875rem; }
    .loading, .error { padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
    .loading { background: #dbeafe; color: #1e40af; }
    .error { background: #fee2e2; color: #991b1b; }
    .form { max-width: 800px; }
    .form-group { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #e5e7eb; }
    .form-group:last-of-type { border-bottom: none; }
    legend { display: block; margin-bottom: 1rem; font-weight: 600; color: #111827; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .form-field { display: flex; flex-direction: column; }
    .form-field label { margin-bottom: 0.5rem; font-weight: 500; font-size: 0.875rem; }
    .form-field input, .form-field textarea, .form-field select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; font-family: inherit; }
    .form-field input[type="checkbox"] { width: auto; margin-right: 0.5rem; }
    .form-field input:focus, .form-field textarea:focus, .form-field select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .resource-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .resource-item { display: flex; align-items: center; }
    .resource-item input { margin-right: 0.5rem; }
    .form-actions { display: flex; gap: 1rem; margin-top: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #e5e7eb; color: #111827; }
    .btn-danger { background: #ef4444; color: white; }
  `]
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
    } catch (error) {
      console.error('Failed to save role:', error);
    }
  }

  async onDelete(): Promise<void> {
    if (!this.role() || !confirm('Are you sure?')) return;
    try {
      await this.store.deleteRole(this.role()!.roleId);
      this.router.navigate(['/admin/roles']);
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  }
}
