import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegisterStore } from '../register.store';

@Component({
  selector: 'app-step-11-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-11-review.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step11ReviewComponent {
  readonly store = inject(RegisterStore);
  private readonly router = inject(Router);

  async confirmAndCreateAccount() {
    this.store.nextStep();
    const success = await this.store.submitRegistration();
    if (success) {
      this.store.nextStep();
      setTimeout(() => {
        this.router.navigate(['/auth/welcome']);
      }, 2000);
    }
  }
}
