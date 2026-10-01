import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IamAdminApiService } from '../../../core/api/iam-admin.api';
import { SessionItem, SessionStats } from '../../../shared/models/iam-admin.model';
import { createListStore } from '../../../shared/utils/create-list-store';
import { DataTableComponent, DataTableColumn, EmptyStateComponent } from '../../../shared/components/iam';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
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
  templateUrl: './sessions.component.html',
  styleUrl: './sessions.component.scss',
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
