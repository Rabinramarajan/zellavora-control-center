import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { RegisterStore } from '../register.store';
import { InputControlComponent } from '@shared/components/input-control';

@Component({
  selector: 'app-step-2-registration-type',
  standalone: true,
  imports: [CommonModule, InputControlComponent],
  templateUrl: './step-2-registration-type.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step2RegistrationTypeComponent {
  readonly store = inject(RegisterStore);
  private readonly messageService = inject(MessageService);
  readonly inviteCode = signal('');

  async verifyInvitation() {
    const code = this.inviteCode().trim();
    if (code.length < 4) return;
    const ok = await this.store.verifyInvitation(code);
    if (ok) {
      this.messageService.add({
        severity: 'success',
        summary: 'Invitation accepted',
        detail: 'Welcome aboard! Let’s set up your account.',
        life: 3000,
      });
      this.store.nextStep();
      this.store.syncProgressToBackend();
    }
  }

  skipInvitation() {
    this.store.setRegistrationType('new_org');
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
