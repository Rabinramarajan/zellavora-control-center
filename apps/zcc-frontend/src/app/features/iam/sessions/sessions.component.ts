import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { AppDialogService } from '../../../shared/components/dialog';
import { FormDialogService } from '../../../shared/components/form-dialog';
import { EmptyStateComponent } from '../../../shared/components/iam';
import {
  DataTableColumn,
  DataTableFilters,
  DataTableCellDirective,
  DataTableComponent,
} from '../../../shared/components/data-table';
import { SessionItem, SessionStats, SessionStatus } from '../../../shared/models/iam-admin.model';
import { IamFeedbackService, errorMessage } from '../shared/iam-feedback.service';
import { formatDateTime, initials, relativeTime } from '../shared/iam-format';
import { sessionDialogConfig } from './session-dialog.config';

/** The sessions API caps pageSize at 100; load every page so filtering stays client-side. */
const LOAD_PAGE_SIZE = 100;

@Component({
  selector: 'zcc-sessions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'filterOpen.set(false)',
  },
  imports: [RouterLink, DataTableComponent, DataTableCellDirective, EmptyStateComponent],
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss',
})
export class SessionsComponent implements OnInit {
  private readonly api = inject(IamAdminApiService);
  private readonly dialog = inject(AppDialogService);
  private readonly formDialog = inject(FormDialogService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Delegated holders may view without revoking; the owner (`*:*`) can always revoke. */
  readonly canRevoke = inject(PermissionService).can('sessions:revoke');

  readonly initialsOf = initials;
  readonly relative = relativeTime;
  readonly dateTime = formatDateTime;

  readonly sessions = signal<SessionItem[]>([]);
  readonly stats = signal<SessionStats | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly filters = signal<DataTableFilters>({ status: '', deviceType: '' });
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [10, 25, 50, 100] as const;

  readonly trackBy = (s: SessionItem) => s.id;

  readonly columns: DataTableColumn<SessionItem>[] = [
    { id: 'userName', label: 'User', sortKey: 'userName', width: '24%' },
    {
      id: 'organizationName',
      label: 'Organization',
      sortKey: 'organizationName',
      value: (s) => s.organizationName ?? '',
    },
    {
      id: 'device',
      label: 'Device',
      sortKey: 'device',
      value: (s) => `${s.browser ?? ''} ${s.platform ?? ''}`.trim(),
    },
    { id: 'ipAddress', label: 'IP Address', sortKey: 'ipAddress', width: '10rem' },
    { id: 'createdAt', label: 'Signed In', sortKey: 'createdAt', width: '9rem' },
    { id: 'lastActivityAt', label: 'Last Active', sortKey: 'lastActivityAt', width: '9rem' },
    { id: 'status', label: 'Status', sortKey: 'status', width: '8rem' },
    // Hidden: only drives the device filter.
    {
      id: 'deviceType',
      label: 'Device Type',
      hidden: true,
      exportable: false,
      value: (s) => (s.isMobile ? 'mobile' : 'desktop'),
    },
    { id: 'actions', label: '', align: 'right', width: '8.5rem', exportable: false },
  ];

  readonly deviceOptions = [
    { value: '', label: 'All' },
    { value: 'desktop', label: 'Desktop' },
    { value: 'mobile', label: 'Mobile' },
  ] as const;

  readonly statusOptions = [
    { value: '', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'signed_out', label: 'Signed out' },
    { value: 'expired', label: 'Expired' },
  ] as const;

  private readonly statusLabel: Record<SessionStatus, string> = {
    active: 'Active',
    signed_out: 'Signed out',
    expired: 'Expired',
  };

  private readonly statusChip: Record<SessionStatus, string> = {
    active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    signed_out: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    expired: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  statusLabelOf(s: SessionItem): string {
    return this.statusLabel[s.status];
  }

  statusChipOf(s: SessionItem): string {
    return this.statusChip[s.status];
  }

  readonly filterOpen = signal(false);
  readonly draftStatus = signal('');
  readonly draftDevice = signal('');
  readonly activeFilterCount = computed(
    () => Object.values(this.filters()).filter((value) => value !== '').length
  );

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    await Promise.all([this.load(), this.loadStats()]);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const all: SessionItem[] = [];
      for (let page = 1, totalPages = 1; page <= totalPages; page++) {
        const result = await firstValueFrom(
          this.api.listSessions({ page, pageSize: LOAD_PAGE_SIZE, status: 'all' })
        );
        all.push(...result.data);
        totalPages = result.meta.totalPages;
      }
      this.sessions.set(all);
    } catch (err) {
      this.error.set(errorMessage(err, 'Could not load sessions.'));
    } finally {
      this.loading.set(false);
    }
  }

  async onView(s: SessionItem): Promise<void> {
    await this.formDialog.open(sessionDialogConfig(s), { size: 'lg' });
  }

  async onRevoke(s: SessionItem): Promise<void> {
    const device = `${s.browser ?? 'Unknown browser'} on ${s.platform ?? 'unknown OS'}`;
    const confirmed = await this.confirm(
      'Revoke session?',
      `${s.userName} will be signed out of ${device} on their next request.`,
      'Revoke'
    );
    if (!confirmed) return;
    await this.run(async () => {
      await firstValueFrom(this.api.revokeSession(s.id));
      return 'Session revoked.';
    });
  }

  async onRevokeAll(s: SessionItem): Promise<void> {
    const confirmed = await this.confirm(
      'Sign out everywhere?',
      `${s.userName} will be signed out of every device${s.isCurrent ? ' except this one' : ''}.`,
      'Sign out'
    );
    if (!confirmed) return;
    await this.run(async () => {
      const { revoked } = await firstValueFrom(this.api.revokeUserSessions(s.userId));
      return `${revoked} session(s) revoked for ${s.userName}.`;
    });
  }

  toggleFilter(): void {
    if (!this.filterOpen()) {
      this.draftStatus.set(this.filters()['status'] ?? '');
      this.draftDevice.set(this.filters()['deviceType'] ?? '');
    }
    this.filterOpen.update((open) => !open);
  }

  applyFilter(): void {
    this.filters.set({ status: this.draftStatus(), deviceType: this.draftDevice() });
    this.filterOpen.set(false);
  }

  resetFilter(): void {
    this.draftStatus.set('');
    this.draftDevice.set('');
    this.filters.set({ status: '', deviceType: '' });
    this.filterOpen.set(false);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.filterOpen()) return;
    const popupRoot = this.host.nativeElement.querySelector('[toolbar-end]');
    if (popupRoot && !popupRoot.contains(event.target as Node)) this.filterOpen.set(false);
  }

  private confirm(title: string, message: string, confirmText: string): Promise<boolean> {
    return firstValueFrom(this.dialog.confirm({ title, message, confirmText, variant: 'danger' }));
  }

  private async run(action: () => Promise<string>): Promise<void> {
    this.busy.set(true);
    try {
      this.feedback.success(await action());
      await this.refresh();
    } catch (err) {
      this.feedback.error(err, 'Could not revoke the session.');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      this.stats.set(await firstValueFrom(this.api.getSessionStats()));
    } catch {
      this.stats.set(null);
    }
  }
}
