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
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../../../core/api/iam-admin.api';
import { PermissionService } from '../../../../../core/rbac/services/permission.service';
import { AppDialogService } from '../../../../../shared/components/dialog';
import { EmptyStateComponent, StatusChipComponent } from '../../../../../shared/components/iam';
import {
  ColumnDef,
  FilterState,
  SmartCellDirective,
  SmartTableComponent,
} from '../../../../../shared/components/smart-table';
import { BranchItem } from '../../../../../shared/models/iam-admin.model';
import { IamFeedbackService, errorMessage } from '../../../../iam/shared/iam-feedback.service';
import { FormDialogMode, FormDialogService } from '../../../../../shared/components/form-dialog';
import { branchDialogConfig, toBranchRequest } from './branch-dialog.config';

/** Upper bound the API accepts per page; branches are few enough to filter client-side. */
const LOAD_PAGE_SIZE = 200;

@Component({
  selector: 'zcc-branch-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'filterOpen.set(false)',
  },
  imports: [
    DatePipe,
    SmartTableComponent,
    SmartCellDirective,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './branch-manager.component.html',
  styleUrl: './branch-manager.component.scss',
})
export class BranchManagerComponent implements OnInit {
  private readonly api = inject(IamAdminApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly formDialog = inject(FormDialogService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly canManage = inject(PermissionService).can('users:manage');

  readonly branches = signal<BranchItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly filters = signal<FilterState>({ status: '' });
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50, 100] as const;

  readonly trackBy = (branch: BranchItem) => branch.id;

  readonly columns: ColumnDef<BranchItem>[] = [
    { key: 'code', header: 'Code', sortable: true, width: '9rem', value: (b) => b.code ?? '' },
    { key: 'name', header: 'Branch Name', sortable: true },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      value: (b) => this.location(b),
    },
    { key: 'userCount', header: 'Users', sortable: true, align: 'right', width: '6rem' },
    { key: 'status', header: 'Status', sortable: true, width: '8rem' },
    { key: 'updatedAt', header: 'Last Updated', sortable: true, width: '9rem' },
    { key: 'actions', header: '', align: 'right', width: '8.5rem', exportable: false },
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

  readonly location = (b: BranchItem) => [b.city, b.country].filter(Boolean).join(', ');

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const page = await firstValueFrom(
        this.api.listBranches({ page: 1, pageSize: LOAD_PAGE_SIZE })
      );
      this.branches.set(page.data);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load branches.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onCreate(): Promise<void> {
    if (await this.openBranchDialog('create')) {
      this.feedback.success('Branch created.');
      await this.load();
    }
  }

  async onView(branch: BranchItem): Promise<void> {
    if (await this.openBranchDialog('view', branch)) {
      this.feedback.success('Branch updated.');
      await this.load();
    }
  }

  async onEdit(branch: BranchItem): Promise<void> {
    if (await this.openBranchDialog('edit', branch)) {
      this.feedback.success('Branch updated.');
      await this.load();
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
      await this.load();
    } catch (err) {
      this.feedback.error(err, 'Could not delete the branch.');
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
    const popupRoot = this.host.nativeElement.querySelector('[toolbar-end]');
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
