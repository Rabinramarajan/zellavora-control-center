import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  auth = inject(AuthService);
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      clientCode: ['demo', [Validators.required]],
      email: ['admin@zellavora.com', [Validators.required, Validators.email]],
      password: ['password123', [Validators.required, Validators.minLength(6)]],
      rememberMe: [true],
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
