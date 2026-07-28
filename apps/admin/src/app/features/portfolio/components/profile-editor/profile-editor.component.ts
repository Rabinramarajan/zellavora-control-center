import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PortfolioService } from '../../services/portfolio.service';

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

  onSubmit(): void {
    if (!this.form.valid) return;

    this.portfolio.updateProfile(this.form.value).subscribe({
      next: () => {
        this.savedSuccessfully = true;
        setTimeout(() => {
          this.savedSuccessfully = false;
        }, 3000);
      },
      error: (error) => {
        console.error('Save error:', error);
      },
    });
  }

  resetForm(): void {
    const profile = this.portfolio.profile();
    if (profile) {
      this.form.patchValue(profile);
    }
  }
}
