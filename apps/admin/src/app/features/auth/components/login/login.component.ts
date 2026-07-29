import { Component, inject, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit {
  auth = inject(AuthService);
  form: FormGroup;

  // Multi-Tenant Org Dropdown State
  showOrgDropdown = false;
  orgSearchQuery = '';
  filteredOrgs: any[] = [];
  allOrgs: any[] = [];
  selectedOrg: any = null;
  loadingOrgs = false;
  showPassword = false;

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
      clientCode: ['demo', [Validators.required]],
      email: ['superadmin@zellavora.com', [Validators.required, Validators.email]],
      password: ['SuperAdmin123!', [Validators.required, Validators.minLength(6)]],
      rememberMe: [true],
    });

    // Pre-fill clientCode from sessionStorage if available
    const stored = sessionStorage.getItem('zcc.clientCode');
    if (stored) {
      this.form.patchValue({ clientCode: stored });
    }
  }

  ngOnInit(): void {
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
