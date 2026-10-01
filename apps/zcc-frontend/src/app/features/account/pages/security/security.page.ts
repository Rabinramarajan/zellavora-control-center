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
  templateUrl: './security.page.html',
  styleUrl: './security.page.scss',
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
