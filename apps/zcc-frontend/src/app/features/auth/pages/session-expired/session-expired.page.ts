import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Landing page after the API rejects an expired or revoked session. Local auth
 * state is already cleared; the intended route is restored after sign-in.
 */
@Component({
  selector: 'app-session-expired-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './session-expired.page.html',
  styleUrl: './session-expired.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExpiredPage {}
