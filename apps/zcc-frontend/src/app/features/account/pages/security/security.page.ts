import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { SecurityEvent, SecurityOverview } from '../../../../shared/models';
import { AuthService } from '../../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../../core/auth/auth-errors';
import { AuthAlertComponent } from '../../../auth/ui/auth-alert.component';
import { TwoFactorCardComponent } from '../../components/two-factor-card.component';
import { SessionsCardComponent } from '../../components/sessions-card.component';

const EVENT_LABELS: Record<string, string> = {
  login: 'Signed in',
  logout: 'Signed out',
  password_change: 'Password changed',
  password_reset_completed: 'Password reset',
  mfa_enrolled: 'Two-factor authentication turned on',
  mfa_disabled: 'Two-factor authentication turned off',
  mfa_recovery_used: 'Signed in with a recovery code',
  mfa_recovery_codes_regenerated: 'Recovery codes regenerated',
  session_revoked: 'Session signed out',
  all_sessions_revoked: 'Signed out of other sessions',
  email_verified: 'Email verified',
  invitation_accepted: 'Account activated',
};

/** Account → Security: password, 2FA, recovery codes, sessions and recent activity. */
@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [DatePipe, RouterLink, AuthAlertComponent, TwoFactorCardComponent, SessionsCardComponent],
  template: `
    <div class="security">
      <header class="security__header">
        <h1 class="auth-title">Security</h1>
        <p class="auth-lead">Manage how you sign in and where your account is signed in.</p>
      </header>

      @if (error()) {
        <app-auth-alert tone="error">{{ error() }}</app-auth-alert>
      }

      @if (overview(); as o) {
        <section class="auth-card-panel pw" aria-labelledby="pw-heading">
          <div>
            <h2 id="pw-heading" class="card-title">Password</h2>
            <p class="card-copy">
              @if (o.passwordChangedAt) {
                Last changed {{ o.passwordChangedAt | date: 'mediumDate' }}.
              } @else {
                Use a long, unique password you don't use anywhere else.
              }
            </p>
          </div>
          <a class="auth-btn auth-btn--secondary auth-btn--inline" routerLink="/account/change-password">
            Change password
          </a>
        </section>

        <app-two-factor-card
          [enabled]="o.mfaEnabled"
          [requiredByOrg]="o.mfaRequiredByOrganization"
          [recoveryCodesRemaining]="o.recoveryCodesRemaining"
          (changed)="reload()"
        />

        <app-sessions-card />

        <section class="auth-card-panel" aria-labelledby="events-heading">
          <h2 id="events-heading" class="card-title">Recent security activity</h2>
          <ul class="events" role="list">
            @for (e of o.recentEvents; track e.id) {
              <li class="event">
                <span class="event__label">{{ label(e) }}</span>
                <span class="event__meta">
                  <time [attr.datetime]="e.createdAt">{{ e.createdAt | date: 'medium' }}</time>
                  @if (e.ipAddress) { · {{ e.ipAddress }} }
                </span>
              </li>
            } @empty {
              <li class="card-copy">No recent activity.</li>
            }
          </ul>
        </section>
      } @else if (!error()) {
        <div role="status" aria-label="Loading your security settings" class="skeletons">
          @for (h of skeletonHeights; track $index) {
            <div class="auth-card-panel skeleton" [style.height.rem]="h" aria-hidden="true">
              <span class="skeleton__line skeleton__line--title"></span>
              <span class="skeleton__line"></span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .security { display: flex; flex-direction: column; gap: 1.25rem; max-width: 46rem; margin: 0 auto; padding-bottom: 2rem; }
    .security__header { margin-bottom: 0.25rem; }
    .card-title { font-size: 1rem; font-weight: 700; color: var(--auth-text-strong); }
    .card-copy { margin-top: 0.25rem; font-size: 0.85rem; line-height: 1.55; color: var(--auth-text-muted); }
    .pw { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
    .events { margin: 0.75rem 0 0; padding: 0; list-style: none; }
    .event {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.25rem 1rem;
      padding: 0.65rem 0;
      border-top: 1px solid var(--auth-border);
      font-size: 0.85rem;
    }
    .event:first-child { border-top: 0; }
    .event__label { color: var(--auth-text-strong); font-weight: 500; }
    .event__meta { color: var(--auth-text-muted); }
    .skeletons { display: flex; flex-direction: column; gap: 1.25rem; }
    .skeleton { display: flex; flex-direction: column; gap: 0.75rem; }
    .skeleton__line {
      display: block;
      height: 0.75rem;
      width: 70%;
      border-radius: 9999px;
      background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0.05) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    .skeleton__line--title { width: 35%; height: 1rem; }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .skeleton__line { animation: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityPage {
  private readonly auth = inject(AuthService);

  protected readonly overview = signal<SecurityOverview | null>(null);
  protected readonly error = signal<string | null>(null);
  // Roughly the heights of the loaded cards, so nothing jumps when data arrives.
  protected readonly skeletonHeights = [6, 9, 12, 10];

  constructor() {
    void this.reload();
  }

  protected label(event: SecurityEvent): string {
    return EVENT_LABELS[event.action] ?? event.action.replace(/_/g, ' ');
  }

  protected async reload(): Promise<void> {
    try {
      this.overview.set(await firstValueFrom(this.auth.securityOverview()));
      this.error.set(null);
    } catch (err) {
      this.error.set(apiErrorMessage(err, "We couldn't load your security settings."));
    }
  }
}
