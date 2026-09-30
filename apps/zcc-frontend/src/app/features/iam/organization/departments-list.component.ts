import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { PermissionService } from '@core/rbac/services/permission.service';
import { DepartmentItem } from '@shared/models/iam-admin.model';
import { createListStore } from '@shared/utils/create-list-store';
import {
  DataTableComponent,
  DataTableColumn,
  EmptyStateComponent,
  StatusChipComponent,
} from '@shared/components/iam';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
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
  template: `
    <zcc-iam-page-header
      title="Departments"
      icon="pi pi-briefcase"
      description="Departments within your organization. Nest them to mirror your structure."
    >
      @if (canManage()) {
        <button type="button" [class]="btn.primary" (click)="create()">
          <i class="pi pi-plus text-xs" aria-hidden="true"></i>
          New department
        </button>
      }
    </zcc-iam-page-header>

    <div class="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
      <div>
        <label for="dept-search" class="sr-only">Search departments</label>
        <input
          id="dept-search"
          type="search"
          placeholder="Search by name or code…"
          [class]="inputClass + ' min-h-[40px]'"
          [value]="store.q()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>
      <div>
        <label for="dept-status" class="sr-only">Filter by status</label>
        <select
          id="dept-status"
          [class]="inputClass + ' min-h-[40px]'"
          (change)="onStatus($any($event.target).value)"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>

    @if (store.loading() && !store.hasItems()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4]; track $index) {
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load departments"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table
        [columns]="columns"
        [rows]="store.items()"
        [rowTemplate]="rowTpl"
        [rowClickable]="true"
        (rowClick)="open($event)"
      >
        <ng-template #rowTpl let-d>
          <td class="px-4 py-3">
            <a
              [routerLink]="['/iam/organization/departments', d.id]"
              class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              (click)="$event.stopPropagation()"
              >{{ d.name }}</a
            >
            @if (d.code) {
              <span class="ml-2 font-mono text-xs text-gray-400">{{ d.code }}</span>
            }
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ d.parentName ?? '—' }}</td>
          <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
            {{ d.memberCount }}
          </td>
          <td class="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-300">
            {{ d.childCount }}
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip
              [value]="d.status"
              [label]="d.status === 'active' ? 'Active' : 'Inactive'"
            />
          </td>
        </ng-template>
      </zcc-data-table>
      <app-pagination
        class="px-1 py-3"
        entityLabel="departments"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-briefcase"
        title="No departments"
        message="Create your first department to organise people."
      />
    }
  `,
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
