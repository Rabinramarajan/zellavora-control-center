import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
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
  private readonly messageService = inject(MessageService);

  async confirmAndCreateAccount() {
    this.store.nextStep();
    const success = await this.store.submitRegistration();
    if (success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Account created',
        detail: 'Your organization has been registered successfully.',
        life: 4000,
      });
    }
  }
}
