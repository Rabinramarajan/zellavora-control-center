import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { AuthStore } from '@core/auth/auth.store';
import { ConfigService } from '@core/config/config.service';
import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Dialog],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  visiblePrivacy = false;
  visibleTerms = false;
  visibleHelp = false;
  auth = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly configService = inject(ConfigService);
  form: FormGroup;

  // Multi-Tenant Org Dropdown State
  showOrgDropdown = false;
  orgSearchQuery = '';
  filteredOrgs: any[] = [];
  allOrgs: any[] = [];
  selectedOrg: any = null;
  loadingOrgs = false;
  showPassword = false;

  redirectToOAuth(provider: string): void {
    const adminApiUrl = this.configService.get('apiUrls.adminApi') || 'https://zcc-backend.vercel.app';
    window.location.href = `${adminApiUrl}/api/v1/auth/oauth/${provider}`;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  clearEmail(): void {
    this.form.get('email')?.setValue('');
    this.form.get('email')?.markAsUntouched();
  }

  clearPassword(): void {
    this.form.get('password')?.setValue('');
    this.form.get('password')?.markAsUntouched();
  }

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

  ngOnInit(): void {
    // 1. Check for OAuth redirection parameters
    this.route.queryParams.subscribe((params) => {
      const accessToken = params['accessToken'];
      const refreshToken = params['refreshToken'];
      const error = params['error'];

      if (accessToken && refreshToken) {
        this.auth.loginWithTokens(accessToken, refreshToken).subscribe();
        return;
      }

      if (error) {
        let msg = 'Social sign-in failed.';
        if (error === 'USER_NOT_FOUND') {
          msg = 'Your social login email is not registered in our platform. Please contact your admin.';
        } else if (error === 'OAUTH_EXCHANGE_FAILED') {
          msg = 'Failed to exchange authentication code with the provider.';
        } else if (error === 'OAUTH_CODE_MISSING') {
          msg = 'Authentication code missing from redirect.';
        }
        this.authStore.setError(msg);
      }
    });

    // 2. Load tenants
    this.loadingOrgs = true;
    this.auth.loadClients().subscribe({
      next: (res) => {
        this.allOrgs = res.tenants || [];
        this.filteredOrgs = [...this.allOrgs];
        this.loadingOrgs = false;
        
        // Match initially loaded client code if present
        const initialCode = this.form.value.clientCode;
        if (initialCode) {
          const matched = this.allOrgs.find(
            (o: any) => o.clientCode.toLowerCase() === initialCode.toLowerCase()
          );
          if (matched) {
            this.selectOrg(matched);
          }
        }
      },
      error: () => {
        this.loadingOrgs = false;
      }
    });
  }

  toggleOrgDropdown(): void {
    this.showOrgDropdown = !this.showOrgDropdown;
  }

  filterOrgs(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.orgSearchQuery = input.value;
    this.filteredOrgs = this.allOrgs.filter((o: any) => 
      o.name.toLowerCase().includes(this.orgSearchQuery.toLowerCase()) ||
      o.clientCode.toLowerCase().includes(this.orgSearchQuery.toLowerCase())
    );
  }

  selectOrg(org: any): void {
    this.selectedOrg = org;
    this.form.patchValue({ clientCode: org.clientCode.toLowerCase() });
    this.showOrgDropdown = false;
    
    // Apply dynamic theme colors based on selected organization
    const root = document.documentElement;
    if (org.clientCode.toUpperCase() === 'DEMO') {
      root.style.setProperty('--primary-color', '#a855f7'); // Purple
      root.style.setProperty('--secondary-color', '#3b82f6'); // Blue
    } else {
      root.style.setProperty('--primary-color', '#3b82f6'); // Blue
      root.style.setProperty('--secondary-color', '#06b6d4'); // Cyan
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
        // Save clientCode to session storage
        sessionStorage.setItem('zcc.clientCode', request.clientCode);
        console.log('Login successful');
      },
      error: (error) => {
        console.error('Login error:', error);
      },
    });
  }
}
