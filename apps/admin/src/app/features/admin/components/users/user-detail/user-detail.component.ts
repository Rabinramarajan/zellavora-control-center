import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminStoreService } from '../../../services';
import { User } from '../../../models';

@Component({
  selector: 'zcc-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="user-detail">
      <header class="page-header">
        <a routerLink="/admin/users" class="back-link">← Back to Users</a>
        <h1>{{ isNew() ? 'New User' : 'Edit User' }}</h1>
      </header>

      <div class="loading" *ngIf="loading()">Loading...</div>
      <div class="error" *ngIf="error()">{{ error() }}</div>

      <form *ngIf="user() && !loading()" (ngSubmit)="onSave()" class="form">
        <fieldset class="form-group">
          <legend>Basic Information</legend>
          <div class="form-row">
            <div class="form-field">
              <label>Login ID</label>
              <input type="text" [(ngModel)]="user()!.userLoginId" name="loginId" required />
            </div>
            <div class="form-field">
              <label>First Name</label>
              <input type="text" [(ngModel)]="user()!.firstName" name="firstName" required />
            </div>
            <div class="form-field">
              <label>Last Name</label>
              <input type="text" [(ngModel)]="user()!.lastName" name="lastName" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-field">
              <label>Email</label>
              <input type="email" [(ngModel)]="user()!.emailId" name="email" required />
            </div>
            <div class="form-field">
              <label>Employee Code</label>
              <input type="text" [(ngModel)]="user()!.employeeCode" name="employeeCode" />
            </div>
          </div>
        </fieldset>

        <fieldset class="form-group">
          <legend>Status</legend>
          <div class="form-row">
            <div class="form-field">
              <label>Status</label>
              <select [(ngModel)]="user()!.statusValue" name="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <div class="form-field">
              <label>Department</label>
              <input type="text" [(ngModel)]="user()!.departmentDescription" name="department" />
            </div>
          </div>
        </fieldset>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Save</button>
          <a routerLink="/admin/users" class="btn btn-secondary">Cancel</a>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .user-detail { padding: 1.5rem; }
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
    .form-field input, .form-field select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; }
    .form-field input:focus, .form-field select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
    .form-actions { display: flex; gap: 1rem; margin-top: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #e5e7eb; color: #111827; }
  `]
})
export class UserDetailComponent implements OnInit {
  private store = inject(AdminStoreService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isNew = signal(true);

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new') {
      const newUser = await this.store.createUser();
      this.user.set(newUser);
      this.isNew.set(true);
    } else if (id) {
      const user = await this.store.openUser(parseInt(id));
      this.user.set(user);
      this.isNew.set(false);
    }
  }

  async onSave(): Promise<void> {
    if (!this.user()) return;
    try {
      await this.store.saveUser(this.user()!);
      this.router.navigate(['/admin/users']);
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  }
}
