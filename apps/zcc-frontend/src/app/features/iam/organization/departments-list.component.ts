import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { AppDialogService } from '../../../shared/components/dialog';
import { FormDialogMode, FormDialogService } from '../../../shared/components/form-dialog';
import { EmptyStateComponent, StatusChipComponent } from '../../../shared/components/iam';
import {
  DataTableColumn,
  DataTableFilters,
  DataTableCellDirective,
  DataTableComponent,
} from '../../../shared/components/data-table';
import { DepartmentItem } from '../../../shared/models/iam-admin.model';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { departmentDialogConfig, toDepartmentRequest } from './department-dialog.config';

/** Upper bound the API accepts per page; departments are few enough to filter client-side. */
const LOAD_PAGE_SIZE = 200;

@Component({
  selector: 'zcc-departments-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'filterOpen.set(false)',
  },
  imports: [
    DatePipe,
    RouterLink,
    DataTableComponent,
    DataTableCellDirective,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './departments-list.component.html',
  styleUrl: './departments-list.component.scss',
})
export class DepartmentsListComponent implements OnInit {
  private readonly api = inject(IamAdminApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly formDialog = inject(FormDialogService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly canManage = inject(PermissionService).can('users:manage');

  readonly departments = signal<DepartmentItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly filters = signal<DataTableFilters>({ status: '' });
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50, 100] as const;

  readonly trackBy = (d: DepartmentItem) => d.id;

  readonly columns: DataTableColumn<DepartmentItem>[] = [
    { id: 'code', label: 'Code', sortKey: 'code', width: '8rem', value: (d) => d.code ?? '' },
    { id: 'name', label: 'Department', sortKey: 'name' },
    { id: 'parentName', label: 'Parent', sortKey: 'parentName', value: (d) => d.parentName ?? '' },
    { id: 'memberCount', label: 'Members', sortKey: 'memberCount', align: 'right', width: '7rem' },
    { id: 'childCount', label: 'Sub-depts', sortKey: 'childCount', align: 'right', width: '7rem' },
    { id: 'status', label: 'Status', sortKey: 'status', width: '8rem' },
    { id: 'updatedAt', label: 'Last Updated', sortKey: 'updatedAt', width: '9rem' },
    { id: 'actions', label: '', align: 'right', width: '8.5rem', exportable: false },
  ];

  readonly statusOptions = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ] as const;

  readonly filterOpen = signal(false);
  readonly draftStatus = signal('');
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((value) => value !== '').length
  );

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(
        this.api.listDepartments({ page: 1, pageSize: LOAD_PAGE_SIZE })
      );
      this.departments.set(page.data);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load departments.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onCreate(): Promise<void> {
    if (await this.openDialog('create')) {
      this.feedback.success('Department created.');
      await this.load();
    }
  }

  async onView(d: DepartmentItem): Promise<void> {
    if (await this.openDialog('view', d)) {
      this.feedback.success('Department updated.');
      await this.load();
    }
  }

  async onEdit(d: DepartmentItem): Promise<void> {
    if (await this.openDialog('edit', d)) {
      this.feedback.success('Department updated.');
      await this.load();
    }
  }

  async onDelete(d: DepartmentItem): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete department?',
        message: d.memberCount
          ? `${d.name} has ${d.memberCount} member(s). They will be unassigned from this department. This cannot be undone.`
          : `${d.name} will be deleted. This cannot be undone.`,
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteDepartment(d.id));
      this.feedback.success(`${d.name} deleted.`);
      await this.load();
    } catch (err) {
      this.feedback.error(err, 'Could not delete the department.');
    }
  }

  toggleFilter(): void {
    if (!this.filterOpen()) this.draftStatus.set(this.filters()['status'] ?? '');
    this.filterOpen.update((open) => !open);
  }

  applyFilter(): void {
    this.filters.update((filters) => ({ ...filters, status: this.draftStatus() }));
    this.filterOpen.set(false);
  }

  resetFilter(): void {
    this.draftStatus.set('');
    this.filters.set({ status: '' });
    this.filterOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.filterOpen()) return;
    const popupRoot = this.host.nativeElement.querySelector('.filter-anchor');
    if (popupRoot && !popupRoot.contains(event.target as Node)) this.filterOpen.set(false);
  }

  /** Resolves true when the department was saved, false when the dialog was dismissed. */
  private async openDialog(mode: FormDialogMode, department?: DepartmentItem): Promise<boolean> {
    // A department cannot be its own parent; the server also rejects deeper cycles.
    const parents = this.departments()
      .filter((p) => p.id !== department?.id)
      .map((p) => ({ label: p.name, value: p.id }));
    const config = departmentDialogConfig(
      mode,
      parents,
      (values, action) =>
        firstValueFrom(
          action === 'edit' && department
            ? this.api.updateDepartment(department.id, toDepartmentRequest(values))
            : this.api.createDepartment(toDepartmentRequest(values))
        ),
      department,
      this.canManage()
    );
    return (await this.formDialog.open(config)) !== null;
  }
}
