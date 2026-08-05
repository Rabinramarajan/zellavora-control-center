import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PortfolioService } from '../../services/portfolio.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile-editor.component.html',
  styleUrl: './profile-editor.component.css',
})
export class ProfileEditorComponent {
  portfolio = inject(PortfolioService);
  fb = inject(FormBuilder);

  form: FormGroup;
  savedSuccessfully = false;

  constructor() {
    this.form = this.fb.group({
      title: ['', Validators.required],
      bio: [''],
      email: ['', Validators.email],
      phone: [''],
      location: [''],
      website: ['', Validators.pattern(/^https?:\/\/.+/)],
      githubUrl: [''],
      linkedinUrl: [''],
      twitterUrl: [''],
      metaDescription: [''],
      metaKeywords: [''],
    });

    // Load profile data when component initializes
    effect(() => {
      const profile = this.portfolio.profile();
      if (profile) {
        this.form.patchValue(profile);
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (!this.form.valid) return;

    try {
      await firstValueFrom(this.portfolio.updateProfile(this.form.value));
      this.savedSuccessfully = true;
      setTimeout(() => {
        this.savedSuccessfully = false;
      }, 3000);
    } catch {
      // Error handling is done by the service
    }
  }

  resetForm(): void {
    const profile = this.portfolio.profile();
    if (profile) {
      this.form.patchValue(profile);
    }
  }
}
