import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { ActiveSession } from '../../../shared/models';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/auth/auth-errors';
import { AuthAlertComponent } from '../../auth/ui/auth-alert.component';
import { ReauthFormComponent, type ReauthSubmission } from './reauth-form.component';

@Component({
  selector: 'app-sessions-card',
  standalone: true,
  imports: [DatePipe, AuthAlertComponent, ReauthFormComponent],
  templateUrl: './sessions-card.component.html',
  styleUrls: ['./account-card.scss', './sessions-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsCardComponent {
  private readonly auth = inject(AuthService);

  protected readonly sessions = signal<ActiveSession[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly reauthError = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly confirmingAll = signal(false);
  protected readonly otherCount = computed(
    () => this.sessions().filter((s) => !s.isCurrent).length
  );

  constructor() {
    void this.load();
  }

  protected async revoke(session: ActiveSession): Promise<void> {
    await this.act(session.id, async () => {
      await firstValueFrom(this.auth.revokeSession(session.id));
      this.sessions.update((list) => list.filter((s) => s.id !== session.id));
      this.notice.set(`Signed out ${session.browser} on ${session.os}.`);
    });
  }

  protected async revokeOthers(): Promise<void> {
    await this.act('others', async () => {
      const { revoked } = await firstValueFrom(this.auth.revokeOtherSessions());
      this.sessions.update((list) => list.filter((s) => s.isCurrent));
      this.notice.set(`Signed out ${revoked} other session${revoked === 1 ? '' : 's'}.`);
    });
  }

  protected async logoutEverywhere({ password }: ReauthSubmission): Promise<void> {
    this.busyId.set('all');
    this.reauthError.set(null);
    try {
      await firstValueFrom(this.auth.logoutAll(password));
    } catch (err) {
      this.reauthError.set(apiErrorMessage(err, "We couldn't sign you out everywhere."));
    } finally {
      this.busyId.set(null);
    }
  }

  private async load(): Promise<void> {
    try {
      this.sessions.set(await firstValueFrom(this.auth.sessions()));
    } catch (err) {
      this.error.set(apiErrorMessage(err, "We couldn't load your sessions."));
    } finally {
      this.loading.set(false);
    }
  }

  private async act(id: string, action: () => Promise<void>): Promise<void> {
    this.busyId.set(id);
    this.error.set(null);
    this.notice.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      this.busyId.set(null);
    }
  }
}
