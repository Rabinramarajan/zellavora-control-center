import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterStore } from '../register.store';

@Component({
  selector: 'app-step-10-terms',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-10-terms.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step10TermsComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    termsAccepted: [false, [Validators.requiredTrue]],
    privacyAccepted: [false, [Validators.requiredTrue]],
    cookieAccepted: [false],
    securityAlertsEnabled: [true],
    marketingEmails: [false],
  });

  ngOnInit() {
    const s = this.store;
    this.form.patchValue({
      termsAccepted: s.termsAccepted(),
      privacyAccepted: s.privacyAccepted(),
      cookieAccepted: s.cookieAccepted(),
      securityAlertsEnabled: s.securityAlertsEnabled(),
      marketingEmails: s.marketingEmails(),
    });
  }

  showError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.store.updateTerms({
      termsAccepted: v.termsAccepted,
      privacyAccepted: v.privacyAccepted,
      cookieAccepted: v.cookieAccepted,
      securityAlertsEnabled: v.securityAlertsEnabled,
      marketingEmails: v.marketingEmails,
    });
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
