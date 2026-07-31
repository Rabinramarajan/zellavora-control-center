import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface LandingAction {
  key: string;
  title: string;
  desc: string;
  icon: string;
  tone: 'violet' | 'indigo' | 'teal' | 'amber';
  primary?: boolean;
  route?: string[];
  href?: string;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['../../auth-shell.css', './landing.component.css'],
})
export class LandingComponent {
  private readonly router = inject(Router);

  readonly pillars = [
    {
      title: 'Secure by Design',
      desc: 'Enterprise-grade security with role-based access and audit logs.',
      tone: 'violet',
      icon: 'shield',
    },
    {
      title: 'All-in-One Platform',
      desc: 'Manage everything from people to products in one powerful workspace.',
      tone: 'indigo',
      icon: 'cube',
    },
    {
      title: 'Built for Performance',
      desc: 'Lightning fast, highly available, and ready to scale with you.',
      tone: 'violet',
      icon: 'bolt',
    },
    {
      title: 'Insights that Matter',
      desc: 'Real-time analytics and dashboards to make smarter decisions.',
      tone: 'teal',
      icon: 'chart',
    },
  ] as const;

  readonly compliance = [
    { label: 'SOC 2', sub: 'Type II' },
    { label: 'GDPR', sub: 'Compliant' },
    { label: 'ISO 27001', sub: 'Certified' },
    { label: '256-BIT', sub: 'Encryption' },
  ];

  readonly actions: LandingAction[] = [
    {
      key: 'register',
      title: 'Register Organization',
      desc: 'Create your organization and workspace',
      icon: 'building',
      tone: 'violet',
      primary: true,
      route: ['/auth/register'],
    },
    {
      key: 'login',
      title: 'Login to Existing Account',
      desc: 'Access your existing workspace',
      icon: 'user',
      tone: 'indigo',
      route: ['/auth/login'],
    },
    {
      key: 'sales',
      title: 'Contact Sales',
      desc: 'Talk to our team about enterprise solutions',
      icon: 'headset',
      tone: 'teal',
      href: 'mailto:sales@zellavora.com',
    },
    {
      key: 'pricing',
      title: 'View Pricing',
      desc: 'Explore plans and find the right fit',
      icon: 'tag',
      tone: 'amber',
      href: 'https://zellavora.com/pricing',
    },
  ];

  select(action: LandingAction): void {
    if (action.route) {
      this.router.navigate(action.route);
      return;
    }
    if (action.href) {
      window.open(action.href, '_blank', 'noopener');
    }
  }
}
