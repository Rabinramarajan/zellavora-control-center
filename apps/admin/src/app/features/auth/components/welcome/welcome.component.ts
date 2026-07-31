import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.component.html',
  styleUrls: ['../../auth-shell.css', './welcome.component.css'],
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  userName = signal<string>('there');
  orgName = signal<string>('your organization');
  autoRedirect = signal<number>(10);
  private countdownInterval: any;

  features = [
    { icon: '🎯', title: 'Dashboard Overview', desc: 'Get a bird-eye view of your entire organization' },
    { icon: '👥', title: 'Team Management', desc: 'Manage users, roles, and permissions' },
    { icon: '🔒', title: 'Enterprise Security', desc: 'Audit logs, MFA, and session control' },
    { icon: '📊', title: 'Analytics', desc: 'Real-time insights and reporting' },
  ];

  ngOnInit() {
    const name =
      this.route.snapshot.queryParamMap.get('name') ||
      sessionStorage.getItem('zcc.welcomeName') ||
      'there';
    const org =
      this.route.snapshot.queryParamMap.get('org') ||
      sessionStorage.getItem('zcc.welcomeOrg') ||
      'your organization';
    this.userName.set(name);
    this.orgName.set(org);

    this.countdownInterval = setInterval(() => {
      if (this.autoRedirect() > 0) {
        this.autoRedirect.update(t => t - 1);
      } else {
        clearInterval(this.countdownInterval);
        this.router.navigate(['/auth/login']);
      }
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.countdownInterval);
  }

  goToLogin() {
    clearInterval(this.countdownInterval);
    this.router.navigate(['/auth/login']);
  }

  /** Returns the CSS width percentage for the countdown progress bar (shrinks from 100 → 0). */
  get progressWidth(): string {
    return `${(this.autoRedirect() / 10) * 100}%`;
  }
}
