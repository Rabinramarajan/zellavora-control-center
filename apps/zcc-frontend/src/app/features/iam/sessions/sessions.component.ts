import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '@core/api/iam-admin.api';
import { SessionItem, SessionStats } from '@shared/models/iam-admin.model';
import { createListStore } from '@shared/utils/create-list-store';
import { DataTableComponent, DataTableColumn, EmptyStateComponent } from '@shared/components/iam';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import {
  IAM_BTN,
  IAM_CARD,
  IAM_INPUT,
  IamPageHeaderComponent,
} from '../shared/iam-page-header.component';
import { IamDialogsService } from '../shared/iam-dialogs.service';
import { IamFeedbackService } from '../shared/iam-feedback.service';
import { formatDateTime, initials, relativeTime } from '../shared/iam-format';

@Component({
  selector: 'zcc-sessions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IamPageHeaderComponent,
    DataTableComponent,
    EmptyStateComponent,
    PaginationComponent,
    RouterLink,
  ],
  template: `
    <zcc-iam-page-header
      title="Sessions"
      icon="pi pi-desktop"
      description="Everyone currently signed in to your organization. Revoking a session signs that device out on its next request."
    >
      <button
        type="button"
        [class]="btn.secondary"
        [disabled]="store.loading()"
        (click)="refresh()"
      >
        <i class="pi pi-refresh text-xs" [class.pi-spin]="store.loading()" aria-hidden="true"></i>
        Refresh
      </button>
    </zcc-iam-page-header>

    <div class="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
      <div [class]="card">
        <p class="text-xs uppercase tracking-wide text-gray-500">Active sessions</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
          {{ stats()?.activeSessions ?? '—' }}
        </p>
      </div>
      <div [class]="card">
        <p class="text-xs uppercase tracking-wide text-gray-500">Signed-in users</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
          {{ stats()?.activeUsers ?? '—' }}
        </p>
      </div>
    </div>

    <div class="mb-4 sm:max-w-sm">
      <label for="session-search" class="sr-only">Search sessions by user</label>
      <input
        id="session-search"
        type="search"
        placeholder="Search by user name or email…"
        [class]="inputClass + ' min-h-[40px]'"
        [value]="store.q()"
        (input)="onSearch($any($event.target).value)"
      />
    </div>

    @if (store.loading() && !store.hasItems()) {
      <div class="space-y-2">
        @for (_ of [1, 2, 3, 4, 5]; track $index) {
          <div class="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5"></div>
        }
      </div>
    } @else if (store.error()) {
      <zcc-empty-state
        icon="pi pi-exclamation-triangle"
        title="Failed to load sessions"
        [message]="store.error()!"
      />
    } @else if (store.hasItems()) {
      <zcc-data-table [columns]="columns" [rows]="store.items()" [rowTemplate]="rowTpl">
        <ng-template #rowTpl let-s>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              @if (s.userAvatarUrl) {
                <img [src]="s.userAvatarUrl" alt="" class="size-8 rounded-full object-cover" />
              } @else {
                <span
                  class="flex size-8 items-center justify-center rounded-full bg-indigo-500/15 text-[11px] font-semibold text-indigo-500"
                  aria-hidden="true"
                  >{{ initialsOf(s.userName) }}</span
                >
              }
              <div class="min-w-0">
                <a
                  [routerLink]="['/iam/users', s.userId]"
                  class="block truncate font-medium text-gray-900 hover:underline dark:text-white"
                  >{{ s.userName }}</a
                >
                <span class="block truncate text-xs text-gray-500 dark:text-gray-400">{{
                  s.userEmail
                }}</span>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300" [title]="s.userAgent ?? ''">
            <i
              [class]="s.isMobile ? 'pi pi-mobile' : 'pi pi-desktop'"
              class="mr-1.5 text-gray-400"
              aria-hidden="true"
            ></i>
            {{ s.browser ?? 'Unknown browser' }} · {{ s.platform ?? 'Unknown OS' }}
            @if (s.isCurrent) {
              <span
                class="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500 ring-1 ring-inset ring-emerald-500/20"
                >This device</span
              >
            }
          </td>
          <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
            {{ s.ipAddress ?? '—' }}
          </td>
          <td class="px-4 py-3 text-gray-600 dark:text-gray-300" [title]="dateTime(s.createdAt)">
            {{ relative(s.createdAt) }}
          </td>
          <td
            class="px-4 py-3 text-gray-600 dark:text-gray-300"
            [title]="dateTime(s.lastActivityAt)"
          >
            {{ relative(s.lastActivityAt) }}
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex justify-end gap-1">
              <button
                type="button"
                [class]="btn.icon + ' hover:!text-red-500'"
                [attr.aria-label]="'Revoke this session for ' + s.userName"
                title="Revoke session"
                [disabled]="s.isCurrent || busy()"
                (click)="revoke(s)"
              >
                <i class="pi pi-sign-out" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                [class]="btn.icon + ' hover:!text-red-500'"
                [attr.aria-label]="'Sign ' + s.userName + ' out everywhere'"
                title="Sign out everywhere"
                [disabled]="busy()"
                (click)="revokeAll(s)"
              >
                <i class="pi pi-power-off" aria-hidden="true"></i>
              </button>
            </div>
          </td>
        </ng-template>
      </zcc-data-table>
      <app-pagination
        class="px-1 py-3"
        entityLabel="sessions"
        [totalItems]="store.total()"
        [page]="store.page()"
        [pageSize]="store.pageSize()"
        (pageChange)="store.setPage($event)"
      />
    } @else {
      <zcc-empty-state
        icon="pi pi-desktop"
        title="No active sessions"
        [message]="
          store.q() ? 'No signed-in users match your search.' : 'Nobody is signed in right now.'
        "
      />
    }
  `,
})
export class SessionsComponent {
  private readonly api = inject(IamAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly inputClass = IAM_INPUT;
  protected readonly initialsOf = initials;
  protected readonly relative = relativeTime;
  protected readonly dateTime = formatDateTime;
  protected readonly stats = signal<SessionStats | null>(null);
  protected readonly busy = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly columns: DataTableColumn[] = [
    { key: 'user', label: 'User' },
    { key: 'device', label: 'Device' },
    { key: 'ip', label: 'IP address' },
    { key: 'signedIn', label: 'Signed in' },
    { key: 'lastActive', label: 'Last active' },
    { key: 'actions', label: '' },
  ];

  readonly store = createListStore<SessionItem>({
    loader: (query) => firstValueFrom(this.api.listSessions(query)),
  });

  constructor() {
    void this.loadStats();
  }

  protected refresh(): void {
    void this.store.reload();
    void this.loadStats();
  }

  protected onSearch(q: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setQ(q.trim()), 300);
  }

  protected async revoke(s: SessionItem): Promise<void> {
    const device = `${s.browser ?? 'Unknown browser'} on ${s.platform ?? 'unknown OS'}`;
    const ok = await this.dialogs.confirm(
      'Revoke session?',
      `${s.userName} will be signed out of ${device}.`,
      'Revoke'
    );
    if (ok) await this.run(() => firstValueFrom(this.api.revokeSession(s.id)), 'Session revoked.');
  }

  protected async revokeAll(s: SessionItem): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Sign out everywhere?',
      `${s.userName} will be signed out of every device${s.isCurrent ? ' except this one' : ''}.`,
      'Sign out'
    );
    if (!ok) return;
    await this.run(async () => {
      const { revoked } = await firstValueFrom(this.api.revokeUserSessions(s.userId));
      return `${revoked} session(s) revoked for ${s.userName}.`;
    });
  }

  private async run(action: () => Promise<unknown>, message?: string): Promise<void> {
    this.busy.set(true);
    try {
      const result = await action();
      this.feedback.success(message ?? String(result));
      this.refresh();
    } catch (err) {
      this.feedback.error(err);
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
