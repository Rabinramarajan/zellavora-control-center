import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RegisterStore } from '../register.store';

@Component({
  selector: 'app-step-1-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  templateUrl: './step-1-welcome.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step1WelcomeComponent {
  readonly store = inject(RegisterStore);

  selectType(type: 'new_org' | 'invite') {
    this.store.setRegistrationType(type);
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }

  continue() {
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
