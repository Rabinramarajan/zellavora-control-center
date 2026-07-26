import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 px-4">
      <div class="w-full max-w-md">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4">
            <span class="text-white text-2xl font-bold">Z</span>
          </div>
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Zellavora Control Center
          </h1>
          <p class="text-slate-600 dark:text-slate-400">
            Enterprise CMS & Administration Platform
          </p>
        </div>

        <!-- Login Form -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
          <!-- Error Message -->
          <div
            *ngIf="auth.error()"
            class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-red-800 dark:text-red-200 text-sm"
          >
            {{ auth.error() }}
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <!-- Client Code Field -->
            <div>
              <label for="clientCode" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Client Code
              </label>
              <input
                id="clientCode"
                type="text"
                formControlName="clientCode"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Your client code"
                [disabled]="auth.isLoading()"
              />
              <p *ngIf="form.get('clientCode')?.hasError('required') && form.get('clientCode')?.touched" class="mt-1 text-sm text-red-600">
                Client code is required
              </p>
            </div>

            <!-- Email Field -->
            <div>
              <label for="email" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="admin@zellavora.com"
                [disabled]="auth.isLoading()"
              />
              <p *ngIf="form.get('email')?.hasError('required') && form.get('email')?.touched" class="mt-1 text-sm text-red-600">
                Email is required
              </p>
              <p *ngIf="form.get('email')?.hasError('email') && form.get('email')?.touched" class="mt-1 text-sm text-red-600">
                Please enter a valid email
              </p>
            </div>

            <!-- Password Field -->
            <div>
              <label for="password" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                class="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
                [disabled]="auth.isLoading()"
              />
              <p *ngIf="form.get('password')?.hasError('required') && form.get('password')?.touched" class="mt-1 text-sm text-red-600">
                Password is required
              </p>
            </div>

            <!-- Remember Me -->
            <div class="flex items-center">
              <input
                id="remember"
                type="checkbox"
                formControlName="rememberMe"
                class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                [disabled]="auth.isLoading()"
              />
              <label for="remember" class="ml-2 text-sm text-slate-600 dark:text-slate-400">
                Remember me
              </label>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              [disabled]="!form.valid || auth.isLoading()"
              class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors mt-6 flex items-center justify-center gap-2"
            >
              <span *ngIf="!auth.isLoading()">Sign In</span>
              <span *ngIf="auth.isLoading()" class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            </button>

            <!-- Forgot Password Link -->
            <div class="text-center">
              <a routerLink="/auth/forgot-password" class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                Forgot password?
              </a>
            </div>
          </form>

          <!-- Divider -->
          <div class="relative my-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-slate-300 dark:border-slate-600"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400">Demo Credentials</span>
            </div>
          </div>

          <!-- Demo Info -->
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p><strong>Email:</strong> <code class="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">{{ 'admin@zellavora.com' }}</code></p>
            <p><strong>Password:</strong> <code class="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">password123</code></p>
          </div>

          <!-- Register Link -->
          <p class="text-center text-sm text-slate-600 dark:text-slate-400 mt-6">
            Don't have an account?
            <a routerLink="/auth/register" class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
              Sign up
            </a>
          </p>
        </div>

        <!-- Footer -->
        <p class="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          © 2026 Zellavora. All rights reserved.
        </p>
      </div>
    </div>
  `,
  styles: [],
})
export class LoginComponent {
  auth = inject(AuthService);
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      clientCode: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });

    // Pre-fill clientCode from sessionStorage if available
    const stored = sessionStorage.getItem('zcc.clientCode');
    if (stored) {
      this.form.patchValue({ clientCode: stored });
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.auth.isLoading()) return;

    const request = {
      clientCode: this.form.value.clientCode,
      email: this.form.value.email,
      password: this.form.value.password,
      rememberMe: this.form.value.rememberMe,
    };

    this.auth.login(request).subscribe({
      next: () => {
        // Auth service handles redirect
        console.log('Login successful');
      },
      error: (error) => {
        // Error is displayed through auth.error() signal
        console.error('Login error:', error);
      },
    });
  }
}
