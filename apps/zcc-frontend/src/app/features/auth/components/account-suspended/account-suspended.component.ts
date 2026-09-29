import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { Router, RouterLink, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-account-suspended',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-suspended.component.html',
  styleUrls: ['../../auth-shell.css', './account-suspended.component.css'],
})
export class AccountSuspendedComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  suspensionReason = signal<string>('Account suspended by administrator');
  supportEmail = signal<string>('support@zellavora.com');
  showDetails = signal<boolean>(false);

  ngOnInit() {
    const reason =
      this.route.snapshot.queryParamMap.get('reason') || 'Account suspended by administrator';
    const email = this.route.snapshot.queryParamMap.get('email') || 'support@zellavora.com';
    this.suspensionReason.set(reason);
    this.supportEmail.set(email);
  }

  contactSupport() {
    window.location.href = `mailto:${this.supportEmail()}?subject=Account Suspension Appeal`;
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
