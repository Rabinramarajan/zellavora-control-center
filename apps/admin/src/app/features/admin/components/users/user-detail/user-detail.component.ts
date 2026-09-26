import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormInputControl,
  SelectControl,
  SelectControlOption,
  emailFieldSchema,
  selectFieldSchema,
  textFieldSchema,
} from '@zellavoras/ui';
import { AdminStoreService } from '../../../services';
import { User } from '../../../models';

type UserDraft = Pick<
  User,
  'userLoginId' | 'firstName' | 'lastName' | 'emailId' | 'employeeCode' | 'statusValue'
> & { departmentDescription: string };

const STATUS_OPTIONS: SelectControlOption[] = [
  { value: 'Active', label: 'Active', color: '#22c55e' },
  { value: 'Inactive', label: 'Inactive', color: '#94a3b8' },
  { value: 'Suspended', label: 'Suspended', color: '#f43f5e' },
];

@Component({
  selector: 'zcc-user-detail',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, SelectControl, RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.css',
})
export class UserDetailComponent implements OnInit {
  private store = inject(AdminStoreService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isNew = signal(true);
  readonly statusOptions = STATUS_OPTIONS;

  private readonly model = signal<UserDraft>({
    userLoginId: '',
    firstName: '',
    lastName: '',
    emailId: '',
    employeeCode: '',
    statusValue: 'Active',
    departmentDescription: '',
  });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.userLoginId, textFieldSchema());
      apply(path.firstName, textFieldSchema());
      apply(path.lastName, textFieldSchema());
      apply(path.emailId, emailFieldSchema());
      apply(path.statusValue, selectFieldSchema({ message: 'Select a status.' }));
    },
    { submission: { action: async () => this.save() } }
  );

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    let user: User | null = null;
    if (id === 'new') {
      user = await this.store.createUser();
      this.isNew.set(true);
    } else if (id) {
      user = await this.store.openUser(parseInt(id));
      this.isNew.set(false);
    }
    if (!user) return;
    this.user.set(user);
    this.model.set({
      userLoginId: user.userLoginId ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      emailId: user.emailId ?? '',
      employeeCode: user.employeeCode ?? '',
      statusValue: user.statusValue || 'Active',
      departmentDescription: user.departmentDescription ?? '',
    });
  }

  private async save(): Promise<undefined> {
    const user = this.user();
    if (!user) return undefined;
    try {
      await this.store.saveUser({ ...user, ...this.model() });
      this.router.navigate(['/admin/users']);
    } catch {
      // Error handling is done by the store
    }
    return undefined;
  }
}
