import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthAlertComponent } from '../../ui/auth-alert.component';
import { takeQueryToken } from '../../ui/form-errors';

type VerifyState = 'verifying' | 'verified' | 'already-verified' | 'invalid';

/** Opened from the email link; verification runs automatically. */
@Component({
  selector: 'app-verify-email-page',
  standalone: true,
  imports: [RouterLink, AuthAlertComponent],
  templateUrl: './verify-email.page.html',
  styleUrl: './verify-email.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPage {
  private readonly auth = inject(AuthService);
  private readonly token = takeQueryToken();

  protected readonly state = signal<VerifyState>(this.token ? 'verifying' : 'invalid');

  constructor() {
    if (this.token) void this.verify();
  }

  private async verify(): Promise<void> {
    try {
      const res = await firstValueFrom(this.auth.verifyEmail(this.token));
      this.state.set(res.alreadyVerified ? 'already-verified' : 'verified');
    } catch {
      this.state.set('invalid');
    }
  }
}
