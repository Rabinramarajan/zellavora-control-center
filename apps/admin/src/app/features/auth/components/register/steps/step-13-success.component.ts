import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegisterStore } from '../register.store';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-step-13-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-13-success.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step13SuccessComponent {
  readonly store = inject(RegisterStore);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  navigateToDashboard() {
    const session = this.store.successData()?.session;
    if (session?.accessToken && session?.refreshToken) {
      // Registration issued a real session — sign the owner straight in.
      this.auth.loginWithTokens(session.accessToken, session.refreshToken).subscribe();
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
