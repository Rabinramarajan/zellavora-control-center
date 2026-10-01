import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Generic confirmation — safe to show on direct access; exposes no account details. */
@Component({
  selector: 'app-password-reset-success-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './password-reset-success.page.html',
  styleUrl: './password-reset-success.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordResetSuccessPage {}
