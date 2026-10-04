import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { SEARCH_ENDPOINTS } from '../../../core/api/search-endpoints';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { AppDialogService } from '../../../shared/components/dialog';
import { StatusChipComponent } from '../../../shared/components/iam';
import {
  DataTableColumn,
  DataTableCellDirective,
  DataTableComponent,
  DataTableSort,
} from '../../../shared/components/data-table';
import { PageChangeEvent } from '../../../shared/components/pagination/pagination.component';
import { BranchItem, BranchSearchCriteria } from '../../../shared/models/iam-admin.model';
import { countActiveFilters, createSearchStore } from '../../../shared/search';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { FormDialogMode, FormDialogService } from '../../../shared/components/form-dialog';
import { branchDialogConfig, toBranchRequest } from './branch-dialog.config';

@Component({
  selector: 'zcc-branches-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'filterOpen.set(false)',
  },
  imports: [DatePipe, DataTableComponent, DataTableCellDirective, StatusChipComponent],
  templateUrl: './branches-list.component.html',
  styleUrl: './branches-list.component.scss',
})
export class BranchesListComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly formDialog = inject(FormDialogService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly canManage = inject(PermissionService).can('users:manage');

  readonly store = createSearchStore<BranchSearchCriteria, BranchItem>({
    endpoint: SEARCH_ENDPOINTS.branches,
  });

  readonly pageSizeOptions = [10, 25, 50, 100];

  readonly trackBy = (branch: BranchItem) => branch.id;

  readonly columns: DataTableColumn<BranchItem>[] = [
    { id: 'code', label: 'Code', sortKey: 'code', width: '9rem', value: (b) => b.code ?? '' },
    { id: 'name', label: 'Branch Name', sortKey: 'name' },
    {
      id: 'location',
      label: 'Location',
      sortKey: 'city',
      value: (b) => this.location(b),
    },
    { id: 'userCount', label: 'Users', align: 'right', width: '6rem' },
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
  readonly activeFilterCount = computed(() => countActiveFilters(this.store.criteria()));

  readonly location = (b: BranchItem) => [b.city, b.country].filter(Boolean).join(', ');

  async onCreate(): Promise<void> {
    if (await this.openBranchDialog('create')) {
      this.feedback.success('Branch created.');
      await this.store.reload();
    }
  }

  async onView(branch: BranchItem): Promise<void> {
    if (await this.openBranchDialog('view', branch)) {
      this.feedback.success('Branch updated.');
      await this.store.reload();
    }
  }

  async onEdit(branch: BranchItem): Promise<void> {
    if (await this.openBranchDialog('edit', branch)) {
      this.feedback.success('Branch updated.');
      await this.store.reload();
    }
  }

  async onDelete(branch: BranchItem): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Delete branch?',
        message: branch.userCount
          ? `${branch.name} (${branch.code}) has ${branch.userCount} user(s). They will be unassigned from this branch. This cannot be undone.`
          : `${branch.name} (${branch.code}) will be deleted. This cannot be undone.`,
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    try {
      await firstValueFrom(this.api.deleteBranch(branch.id));
      this.feedback.success(`${branch.name} deleted.`);
      await this.store.reload();
    } catch (err) {
      this.feedback.error(err, 'Could not delete the branch.');
    }
  }

  toggleFilter(): void {
    if (!this.filterOpen()) this.draftStatus.set(this.store.criteria()?.statusValue ?? '');
    this.filterOpen.update((open) => !open);
  }

  applyFilter(): void {
    this.filterOpen.set(false);
    const status = this.draftStatus();
    void this.store.search({
      statusValue: status === '' ? null : (status as 'active' | 'inactive'),
    });
  }

  resetFilter(): void {
    this.draftStatus.set('');
    this.filterOpen.set(false);
    void this.store.reset();
  }

  onSort(sort: DataTableSort | null): void {
    void this.store.sortBy(sort);
  }

  onPaginate({ page, pageSize }: PageChangeEvent): void {
    void this.store.setPage(page, pageSize);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.filterOpen()) return;
    const popupRoot = this.host.nativeElement.querySelector('.filter-anchor');
    if (popupRoot && !popupRoot.contains(event.target as Node)) this.filterOpen.set(false);
  }

  /** Resolves true when the branch was saved, false when the dialog was dismissed. */
  private async openBranchDialog(mode: FormDialogMode, branch?: BranchItem): Promise<boolean> {
    const config = branchDialogConfig(
      mode,
      (values, action) =>
        firstValueFrom(
          action === 'edit' && branch
            ? this.api.updateBranch(branch.id, toBranchRequest(values))
            : this.api.createBranch(toBranchRequest(values))
        ),
      branch,
      this.canManage()
    );
    return (await this.formDialog.open(config)) !== null;
  }
}
