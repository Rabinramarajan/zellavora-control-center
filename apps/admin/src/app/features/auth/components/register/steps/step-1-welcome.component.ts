import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegisterStore } from '../register.store';

@Component({
  selector: 'app-step-1-welcome',
  standalone: true,
  imports: [CommonModule],
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
