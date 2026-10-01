import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { DepartmentItem } from '../../../shared/models/iam-admin.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  EmptyStateComponent,
  StatusChipComponent,
} from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { IAM_BTN, IAM_INPUT, IamPageHeaderComponent } from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { departmentFields, toDepartmentRequest } from './department-form';

@Component({
  selector: 'zcc-departments-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IamPageHeaderComponent,
    DataTableComponent,
    EmptyStateComponent,
    StatusChipComponent,
    PaginationComponent,
    RouterLink,
  ],
  templateUrl: './departments-list.component.html',
  styleUrl: './departments-list.component.scss',
})
export class DepartmentsListComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly router = inject(Router);

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly canManage = inject(PermissionService).can('users:manage');
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Department' },
    { key: 'parent', label: 'Parent' },
    { key: 'members', label: 'Members' },
    { key: 'children', label: 'Sub-departments' },
    { key: 'status', label: 'Status' },
  ];

  readonly store = createListStore<DepartmentItem>({
    initialPageSize: 50,
    filterKeys: ['status'],
    loader: (query) => firstValueFrom(this.api.listDepartments(query)),
  });

  protected onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(q.trim()), 300);
  }

  protected onStatus(status: string): void {
    this.store.setFilters(status ? { status } : {});
  }

  protected open(d: DepartmentItem): void {
    void this.router.navigate(['/iam/organization/departments', d.id]);
  }

  protected async create(): Promise<void> {
    const parents = await this.parentOptions();
    await this.dialogs.form({
      title: 'New department',
      submitText: 'Create',
      fields: departmentFields(parents),
      submit: async (v) => {
        const created = await firstValueFrom(this.api.createDepartment(toDepartmentRequest(v)));
        this.feedback.success(`${created.name} created.`);
        void this.router.navigate(['/iam/organization/departments', created.id]);
      },
    });
  }

  private async parentOptions() {
    try {
      const all = await firstValueFrom(this.api.listDepartments({ page: 1, pageSize: 200 }));
      return all.data.map((d) => ({ label: d.name, value: d.id }));
    } catch (err) {
      this.feedback.error(err, 'Could not load departments.');
      return [];
    }
  }
}
