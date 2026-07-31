import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterStore } from '../register.store';

@Component({
  selector: 'app-step-2-registration-type',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step-2-registration-type.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step2RegistrationTypeComponent {
  readonly store = inject(RegisterStore);
  readonly inviteCode = signal('');

  onInviteInput(event: Event) {
    this.inviteCode.set((event.target as HTMLInputElement).value);
  }

  async verifyInvitation() {
    const code = this.inviteCode().trim();
    if (code.length < 4) return;
    const ok = await this.store.verifyInvitation(code);
    if (ok) {
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
