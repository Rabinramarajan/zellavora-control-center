import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { MessageService } from 'primeng/api';
import { RegisterStore } from '../register.store';
import { FormInputControl } from '@zellavoras/ui';

@Component({
  selector: 'app-step-2-registration-type',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormInputControl],
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
