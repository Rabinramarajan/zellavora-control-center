import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { PermissionService } from '@core/rbac/services/permission.service';
import { InvitationItem, InvitationStatus } from '@shared/models/iam-admin.model';
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
import { formatDateTime, relativeTime } from '../shared/iam-format';

type StatusTab = InvitationStatus | 'all';

const TABS: Array<{ value: StatusTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'expired', label: 'Expired' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'revoked', label: 'Revoked' },
];

const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: 'Pending',
  expired: 'Expired',
  accepted: 'Accepted',
  revoked: 'Revoked',
};

@Component({
  selector: 'zcc-user-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IamPageHeaderComponent,
    DataTableComponent,
    EmptyStateComponent,
    StatusChipComponent,
    PaginationComponent,
  ],
  template: `
    <zcc-iam-page-header
      title="User Requests"
      icon="pi pi-inbox"
      description="Invitations sent to people joining your organization. Resend expired links or revoke ones that are no longer needed."
    >
      @if (canManage()) {
        <button type="button" [class]="btn.primary" (click)="invite()">
          <i class="pi pi-user-plus text-xs" aria-hidden="true"></i>
          Invite user
        </button>
      }
    </zcc-iam-page-header>

    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div
        role="tablist"
        aria-label="Invitation status"
        class="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-white/5"
      >
        @for (tab of tabs; track tab.value) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="status() === tab.value"
            class="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
            [class]="
              status() === tab.value
                ? 'bg-white text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            "
            (click)="setStatus(tab.value)"
          >
            {{ tab.label }}
            <span
              class="rounded-full bg-gray-200 px-1.5 text-[11px] tabular-nums dark:bg-white/10"
              >{{ countFor(tab.value) }}</span
            >
          </button>
        }
      </div>
      <div class="w-full lg:w-72">
        <label for="invite-search" class="sr-only">Search invitations</label>
        <input
          id="invite-search"
          type="search"
          placeholder="Search by name or email…"
          [class]="inputClass + ' min-h-[40px]'"
          [value]="store.q()"
          (input)="onSearch($any($event.target).value)"
        />
      </div>
    </div>

    @if (store.loading() && !store.hasItems()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4, 5]; track $index) {
          <div class="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load invitations"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table [columns]="columns" [rows]="store.items()" [rowTemplate]="rowTpl">
        <ng-template #rowTpl let-r>
          <td class="px-4 py-3">
            <div class="font-medium text-gray-900 dark:text-white">
              {{ fullName(r) || r.email }}
            </div>
            @if (fullName(r)) {
              <div class="text-xs text-gray-500 dark:text-gray-400">{{ r.email }}</div>
            }
          </td>
          <td class="px-4 py-3">
            <zcc-status-chip [value]="r.status" [label]="labelFor(r.status)" />
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ r.invitedByName ?? '—' }}</td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300" [title]="dateTime(r.createdAt)">
            {{ relative(r.createdAt) }}
          </td>
          <td
            class="px-4 py-3 text-gray-600 dark:text-gray-300"
            [title]="dateTime(r.usedAt ?? r.expiresAt)"
          >
            @if (r.status === 'accepted') {
              Accepted {{ relative(r.usedAt) }}
            } @else if (r.status === 'pending') {
              Expires {{ relative(r.expiresAt) }}
            } @else if (r.status === 'expired') {
              Expired {{ relative(r.expiresAt) }}
            } @else {
              —
            }
          </td>
          <td class="px-4 py-3 text-right">
            @if (canManage() && r.status !== 'accepted') {
              <div class="flex justify-end gap-1">
                <button
                  type="button"
                  [class]="btn.icon"
                  [attr.aria-label]="'Resend invitation to ' + r.email"
                  title="Resend"
                  [disabled]="busyId() === r.id"
                  (click)="resend(r)"
                >
                  <i class="pi pi-send" aria-hidden="true"></i>
                </button>
                @if (r.status === 'pending') {
                  <button
                    type="button"
                    [class]="btn.icon + ' hover:!text-red-500'"
                    [attr.aria-label]="'Revoke invitation for ' + r.email"
                    title="Revoke"
                    [disabled]="busyId() === r.id"
                    (click)="revoke(r)"
                  >
                    <i class="pi pi-ban" aria-hidden="true"></i>
                  </button>
                }
              </div>
            }
          </td>
        </ng-template>
      </zcc-data-table>
      <app-pagination
        class="px-1 py-3"
        entityLabel="invitations"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-inbox"
        title="No invitations"
        [message]="
          store.q() || status() !== 'all'
            ? 'Nothing matches the current filters.'
            : 'Invite someone to get started.'
        "
      />
    }
  `,
})
export class UserRequestsComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly tabs = TABS;
  protected labelFor(status: InvitationStatus): string {
    return STATUS_LABEL[status];
  }
  protected readonly relative = relativeTime;
  protected readonly dateTime = formatDateTime;
  protected readonly canManage = inject(PermissionService).can('users:manage');

  protected readonly status = signal<StatusTab>('all');
  protected readonly busyId = signal<string | null>(null);
  private readonly counts = signal<Record<InvitationStatus, number> | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly columns: DataTableColumn[] = [
    { key: 'person', label: 'Person' },
    { key: 'status', label: 'Status' },
    { key: 'invitedBy', label: 'Invited by' },
    { key: 'sent', label: 'Sent' },
    { key: 'expiry', label: 'Expiry' },
    { key: 'actions', label: '' },
  ];

  readonly store = createListStore<InvitationItem>({
    filterKeys: ['status'],
    loader: async (query) => {
      const list = await firstValueFrom(this.api.listInvitations(query));
      this.counts.set(list.counts);
      return list;
    },
  });

  private readonly total = computed(() => {
    const c = this.counts();
    return c ? c.pending + c.expired + c.accepted + c.revoked : 0;
  });

  protected countFor(tab: StatusTab): number {
    return tab === 'all' ? this.total() : (this.counts()?.[tab] ?? 0);
  }

  protected fullName(r: InvitationItem): string {
    return [r.firstName, r.lastName].filter(Boolean).join(' ');
  }

  protected setStatus(tab: StatusTab): void {
    this.status.set(tab);
    this.store.setFilters(tab === 'all' ? {} : { status: tab });
  }

  protected onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(q.trim()), 300);
  }

  protected async invite(): Promise<void> {
    const result = await this.dialogs.form({
      title: 'Invite user',
      description:
        'They will receive an email with a link to set a password and join your organization.',
      submitText: 'Send invitation',
      fields: [
        {
          key: 'email',
          label: 'Email',
          type: 'email',
          required: true,
          maxLength: 254,
          placeholder: 'name@company.com',
        },
        { key: 'firstName', label: 'First name', type: 'text', maxLength: 100 },
        { key: 'lastName', label: 'Last name', type: 'text', maxLength: 100 },
      ],
      submit: (v) =>
        firstValueFrom(
          this.api.inviteUser({
            email: String(v['email']).toLowerCase(),
            firstName: (v['firstName'] as string) || null,
            lastName: (v['lastName'] as string) || null,
          })
        ),
    });
    if (!result) return;
    this.feedback.success(`Invitation sent to ${result['email']}.`);
    await this.store.reload();
  }

  protected async resend(r: InvitationItem): Promise<void> {
    await this.run(
      r,
      () => firstValueFrom(this.api.resendInvitation(r.id)),
      `A new link was sent to ${r.email}.`
    );
  }

  protected async revoke(r: InvitationItem): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Revoke invitation?',
      `${r.email} will no longer be able to use their invitation link.`,
      'Revoke'
    );
    if (ok)
      await this.run(
        r,
        () => firstValueFrom(this.api.revokeInvitation(r.id)),
        'Invitation revoked.'
      );
  }

  private async run(
    r: InvitationItem,
    action: () => Promise<unknown>,
    message: string
  ): Promise<void> {
    this.busyId.set(r.id);
    try {
      await action();
      this.feedback.success(message);
      await this.store.reload();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busyId.set(null);
    }
  }
}
