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
import {
  FormDialogData,
  FormValues,
  IamFormDialogComponent,
} from '../../../../iam/shared/iam-form-dialog.component';
import { IamFeedbackService, errorMessage } from '../../../../iam/shared/iam-feedback.service';
import { branchFields, toBranchRequest } from './branch-form';

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
    const saved = await this.openForm({
      title: 'New branch',
      description: 'The branch code is generated automatically when you save.',
      submitText: 'Create branch',
      fields: branchFields(),
      submit: (v) => firstValueFrom(this.api.createBranch(toBranchRequest(v))),
    });
    if (saved) {
      this.feedback.success('Branch created.');
      await this.load();
    }
  }

  async onView(branch: BranchItem): Promise<void> {
    await this.openForm({
      title: branch.name,
      description: branch.code ? `Branch code ${branch.code}` : undefined,
      submitText: 'Close',
      fields: branchFields(branch, true),
      submit: async () => undefined,
    });
  }

  async onEdit(branch: BranchItem): Promise<void> {
    const saved = await this.openForm({
      title: `Edit ${branch.name}`,
      submitText: 'Save changes',
      fields: branchFields(branch),
      submit: (v) => {
        const body = toBranchRequest(v);
        // The toggle is locked on the head office; never send a demotion from here.
        if (branch.isHeadOffice) delete body.isHeadOffice;
        return firstValueFrom(this.api.updateBranch(branch.id, body));
      },
    });
    if (saved) {
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

  /** Resolves true when the form was submitted successfully, false when cancelled. */
  private async openForm(data: FormDialogData): Promise<boolean> {
    const ref = this.dialog.open<IamFormDialogComponent, FormDialogData, FormValues | null>(
      IamFormDialogComponent,
      { data, size: 'md', disableClose: true }
    );
    return (await firstValueFrom(ref.closed)) != null;
  }
}
