import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RegisterStore } from '../register.store';

@Component({
  selector: 'app-step-7-branch',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './step-7-branch.component.html',
  styleUrls: ['../step-styles.css'],
})
export class Step7BranchComponent implements OnInit {
  readonly store = inject(RegisterStore);
  private readonly fb = inject(FormBuilder);

  readonly locating = { value: false };

  readonly form = this.fb.nonNullable.group({
    branchName: ['Head Office', [Validators.required, Validators.minLength(2)]],
    branchAddress: [''],
    branchCity: [''],
    branchState: [''],
    branchCountry: ['', [Validators.required]],
    branchPincode: ['', [Validators.pattern(/^[0-9a-zA-Z\s-]{3,10}$/)]],
    branchPhone: ['', [Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]],
    branchEmail: ['', [Validators.email]],
    branchLatitude: ['', [Validators.pattern(/^-?\d{1,3}(\.\d+)?$/)]],
    branchLongitude: ['', [Validators.pattern(/^-?\d{1,3}(\.\d+)?$/)]],
  });

  ngOnInit() {
    const s = this.store;
    this.form.patchValue({
      branchName: s.branchName(),
      branchAddress: s.branchAddress(),
      branchCity: s.branchCity(),
      branchState: s.branchState(),
      branchCountry: s.branchCountry(),
      branchPincode: s.branchPincode(),
      branchPhone: s.branchPhone(),
      branchEmail: s.branchEmail(),
      branchLatitude: s.branchLatitude() || '',
      branchLongitude: s.branchLongitude() || '',
    });
  }

  showError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  errorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    const errors = control.errors;
    if (errors['required']) return 'This field is required.';
    if (errors['email']) return 'Enter a valid email address.';
    if (errors['pattern']) return 'Invalid format.';
    if (errors['minlength']) {
      return `Must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    return 'Please fix this field.';
  }

  useCurrentLocation() {
    if (this.locating.value) return;
    this.locating.value = true;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        this.locating.value = false;
        this.form.patchValue({
          branchLatitude: pos.coords.latitude.toFixed(6),
          branchLongitude: pos.coords.longitude.toFixed(6),
        });
        this.form.get('branchLatitude')?.markAsDirty();
        this.form.get('branchLongitude')?.markAsDirty();
      },
      () => {
        this.locating.value = false;
      },
      { timeout: 10000 }
    );
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.store.updateBranchInfo({
      branchName: v.branchName,
      branchAddress: v.branchAddress,
      branchCity: v.branchCity,
      branchState: v.branchState,
      branchCountry: v.branchCountry,
      branchPincode: v.branchPincode,
      branchPhone: v.branchPhone,
      branchEmail: v.branchEmail,
      branchLatitude: v.branchLatitude,
      branchLongitude: v.branchLongitude,
    });
    this.store.nextStep();
    this.store.syncProgressToBackend();
  }
}
