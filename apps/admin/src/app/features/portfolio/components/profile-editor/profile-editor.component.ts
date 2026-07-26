import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PortfolioService } from '../../services/portfolio.service';

@Component({
  selector: 'app-profile-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="p-6 space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Profile Information</h2>
        <p class="text-slate-600 dark:text-slate-400">Edit your professional profile details</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- Title -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Title
          </label>
          <input
            type="text"
            formControlName="title"
            placeholder="e.g., Full Stack Engineer"
            class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Your professional title or headline
          </p>
        </div>

        <!-- Bio -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Bio
          </label>
          <textarea
            formControlName="bio"
            placeholder="Tell us about yourself..."
            rows="4"
            class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          ></textarea>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Brief professional biography
          </p>
        </div>

        <!-- Contact Info Grid -->
        <div class="grid md:grid-cols-2 gap-4">
          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              formControlName="email"
              placeholder="your@email.com"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <!-- Phone -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Phone
            </label>
            <input
              type="tel"
              formControlName="phone"
              placeholder="+1 (555) 123-4567"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <!-- Location -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Location
            </label>
            <input
              type="text"
              formControlName="location"
              placeholder="City, Country"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <!-- Website -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Website
            </label>
            <input
              type="url"
              formControlName="website"
              placeholder="https://yourwebsite.com"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <!-- Social Links Grid -->
        <div class="grid md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              GitHub
            </label>
            <input
              type="url"
              formControlName="githubUrl"
              placeholder="https://github.com/username"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              LinkedIn
            </label>
            <input
              type="url"
              formControlName="linkedinUrl"
              placeholder="https://linkedin.com/in/username"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Twitter
            </label>
            <input
              type="url"
              formControlName="twitterUrl"
              placeholder="https://twitter.com/username"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <!-- SEO Fields -->
        <div class="border-t border-slate-200 dark:border-slate-700 pt-6">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">SEO Metadata</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Meta Description
              </label>
              <textarea
                formControlName="metaDescription"
                placeholder="Brief description for search engines"
                rows="2"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              ></textarea>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {{ form.get('metaDescription')?.value?.length || 0 }}/160 characters
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Meta Keywords
              </label>
              <input
                type="text"
                formControlName="metaKeywords"
                placeholder="keyword1, keyword2, keyword3"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        <!-- Submit Button -->
        <div class="flex gap-3 pt-4">
          <button
            type="submit"
            [disabled]="!form.valid || portfolio.isLoading()"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            <span *ngIf="!portfolio.isLoading()">💾 Save Changes</span>
            <span *ngIf="portfolio.isLoading()" class="flex items-center gap-2">
              <span class="animate-spin">⏳</span>
              Saving...
            </span>
          </button>
          <button
            type="button"
            (click)="resetForm()"
            class="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Reset
          </button>
        </div>

        <!-- Success Message -->
        <div
          *ngIf="savedSuccessfully"
          class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg text-green-700 dark:text-green-300"
        >
          ✅ Profile saved successfully!
        </div>
      </form>
    </div>
  `,
  styles: [],
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
