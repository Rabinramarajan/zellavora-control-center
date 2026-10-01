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
  template: `
    <section class="auth-card-panel" aria-labelledby="sessions-heading" [attr.aria-busy]="loading()">
      <div class="card-head">
        <div>
          <h2 id="sessions-heading" class="card-title">Active sessions</h2>
          <p class="card-copy">Devices currently signed in to your account. Sign out any you don't recognize.</p>
        </div>
      </div>

      @if (error()) {
        <app-auth-alert tone="error">{{ error() }}</app-auth-alert>
      }
      @if (notice()) {
        <app-auth-alert tone="success">{{ notice() }}</app-auth-alert>
      }

      @if (loading()) {
        <p class="card-meta" role="status">Loading sessions…</p>
      } @else {
        <ul class="sessions" role="list">
          @for (s of sessions(); track s.id) {
            <li class="session">
              <div class="session__icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8 20h8M12 16.5V20" />
                </svg>
              </div>
              <div class="session__body">
                <p class="session__name">
                  {{ s.browser }} on {{ s.os }}
                  @if (s.isCurrent) {
                    <span class="badge badge--on">This device</span>
                  }
                </p>
                <p class="session__meta">
                  {{ s.ipAddress ?? 'Unknown location' }} · Active {{ s.lastActivityAt | date: 'medium' }}
                </p>
              </div>
              @if (!s.isCurrent) {
                <button
                  type="button"
                  class="auth-btn auth-btn--secondary auth-btn--inline"
                  [disabled]="busyId() === s.id"
                  [attr.aria-label]="'Sign out ' + s.browser + ' on ' + s.os"
                  (click)="revoke(s)"
                >
                  {{ busyId() === s.id ? 'Signing out…' : 'Sign out' }}
                </button>
              }
            </li>
          } @empty {
            <li class="card-meta">No active sessions.</li>
          }
        </ul>
      }

      @if (confirmingAll()) {
        <app-reauth-form
          prompt="This signs you out everywhere, including this device."
          submitLabel="Sign out everywhere"
          [danger]="true"
          [busy]="busyId() === 'all'"
          [error]="reauthError()"
          (confirmed)="logoutEverywhere($event)"
          (cancelled)="confirmingAll.set(false)"
        />
      } @else {
        <div class="card-actions">
          @if (otherCount() > 0) {
            <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" [disabled]="busyId() === 'others'" (click)="revokeOthers()">
              Sign out other sessions
            </button>
          }
          <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline danger-text" (click)="confirmingAll.set(true)">
            Sign out everywhere
          </button>
        </div>
      }
    </section>
  `,
  styleUrl: './account-card.css',
  styles: `
    .sessions { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; }
    .session {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 0;
      border-top: 1px solid var(--auth-border);
    }
    .session:first-child { border-top: 0; padding-top: 0; }
    .session__icon {
      display: grid;
      place-items: center;
      width: 2.4rem;
      height: 2.4rem;
      flex-shrink: 0;
      border-radius: 0.7rem;
      background: var(--auth-surface-raised);
      color: var(--auth-text-muted);
    }
    .session__body { flex: 1; min-width: 0; }
    .session__name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--auth-text-strong);
    }
    .session__meta { margin-top: 0.15rem; font-size: 0.8rem; color: var(--auth-text-muted); overflow-wrap: anywhere; }
  `,
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
  protected readonly otherCount = computed(() => this.sessions().filter((s) => !s.isCurrent).length);

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
