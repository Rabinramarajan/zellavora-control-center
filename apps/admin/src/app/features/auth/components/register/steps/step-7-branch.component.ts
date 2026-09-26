import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormField, FormRoot, apply, email, form, pattern } from '@angular/forms/signals';
import {
  FormInputControl,
  SelectControl,
  selectFieldSchema,
  textFieldSchema,
} from '@zellavoras/ui';
import { RegisterStore } from '../register.store';
import { FORM_PATTERNS } from '@shared/utils/form-patterns';
import { stringsToOptions } from '@shared/utils/select-options';

const COORDINATE = /^-?\d{1,3}(\.\d+)?$/;

@Component({
  selector: 'app-step-7-branch',
  standalone: true,
  imports: [CommonModule, FormField, FormRoot, FormInputControl, SelectControl],
  templateUrl: './step-7-branch.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step7BranchComponent {
  readonly store = inject(RegisterStore);

  readonly locating = signal(false);
  readonly countryOptions = computed(() => stringsToOptions(this.store.countryOptions()));

  private readonly model = signal({
    branchName: this.store.branchName() || 'Head Office',
    branchAddress: this.store.branchAddress(),
    branchCity: this.store.branchCity(),
    branchState: this.store.branchState(),
    branchCountry: this.store.branchCountry(),
    branchPincode: this.store.branchPincode(),
    branchPhone: this.store.branchPhone(),
    branchEmail: this.store.branchEmail(),
    branchLatitude: this.store.branchLatitude() || '',
    branchLongitude: this.store.branchLongitude() || '',
  });

  readonly form = form(
    this.model,
    (path) => {
      apply(path.branchName, textFieldSchema({ minLength: 2 }));
      apply(path.branchCountry, selectFieldSchema({ message: 'Select the branch country.' }));
      pattern(path.branchPincode, /^[0-9a-zA-Z\s-]{3,10}$/, {
        message: 'Enter a valid postal code.',
      });
      pattern(path.branchPhone, FORM_PATTERNS.phone, { message: 'Enter a valid phone number.' });
      email(path.branchEmail, { message: 'Enter a valid email address.' });
      pattern(path.branchLatitude, COORDINATE, { message: 'Enter a decimal latitude.' });
      pattern(path.branchLongitude, COORDINATE, { message: 'Enter a decimal longitude.' });
    },
    { submission: { action: async () => this.save() } }
  );

  useCurrentLocation() {
    if (this.locating() || !navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        this.form.branchLatitude().value.set(pos.coords.latitude.toFixed(6));
        this.form.branchLongitude().value.set(pos.coords.longitude.toFixed(6));
        this.form.branchLatitude().markAsDirty();
        this.form.branchLongitude().markAsDirty();
      },
      () => this.locating.set(false),
      { timeout: 10000 }
    );
  }

  private save(): undefined {
    this.store.updateBranchInfo(this.model());
    this.store.nextStep();
    this.store.syncProgressToBackend();
    return undefined;
  }
}
