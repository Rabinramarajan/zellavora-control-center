import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionsCardComponent } from '../../components/sessions-card.component';

/** Account → Active sessions: the signed-in user's own devices, outside IAM. */
@Component({
  selector: 'app-sessions-page',
  standalone: true,
  imports: [RouterLink, SessionsCardComponent],
  template: `
    <div class="security">
      <header class="security__header">
        <h1 class="auth-title">Active sessions</h1>
        <p class="auth-lead">
          Devices signed in to your account. Password and two-factor settings are under
          <a class="auth-link" routerLink="/account/security">Security</a>.
        </p>
      </header>
      <app-sessions-card />
    </div>
  `,
  styleUrl: '../security/security.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionsPage {}
