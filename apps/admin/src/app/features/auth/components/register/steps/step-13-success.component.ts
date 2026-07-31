import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegisterStore } from '../register.store';

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

  navigateToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  navigateToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
