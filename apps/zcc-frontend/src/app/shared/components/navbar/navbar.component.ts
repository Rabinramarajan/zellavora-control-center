import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AppDialogService } from '../dialog';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { firstValueFrom } from 'rxjs';

interface BreadcrumbSegment {
  label: string;
  route: string;
}

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  auth = inject(AuthService);
  router = inject(Router);
  layoutService = inject(LayoutService);
  private readonly dialog = inject(AppDialogService);

  isUserMenuOpen = signal(false);
  avatarFailed = signal(false);
  avatarSrc = computed(() => this.auth.user()?.avatarUrl || 'assets/rabin_avatar.jpg');
  displayName = computed(() => this.auth.user()?.fullName || 'Rabin R');
  displayRole = computed(() => this.auth.user()?.role || 'Super Admin');

  constructor() {
    // A newly uploaded avatar deserves a fresh load attempt even if the previous one failed.
    effect(() => {
      this.avatarSrc();
      untracked(() => this.avatarFailed.set(false));
    });
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeUserMenu();
    const confirmed = await firstValueFrom(
      this.dialog.confirm({
        title: 'Log out?',
        message: 'Are you sure you want to log out of your account?',
        confirmText: 'Yes, log out',
        cancelText: 'Cancel',
        variant: 'danger',
      })
    );
    if (!confirmed) return;
    await firstValueFrom(this.auth.logout());
  }

  getBreadcrumbs(): BreadcrumbSegment[] {
    const url = this.router.url.split('?')[0]; // Strip query parameters
    const segments = url.split('/').filter((s) => s);

    if (segments.length === 0) {
      return [{ label: 'Dashboard', route: '' }];
    }

    const labelMap: Record<string, string> = {
      dashboard: 'Dashboard',
      portfolio: 'Portfolio',
      profile: 'Profile',
      hero: 'Hero Section',
      about: 'About Section',
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
      services: 'Services',
      testimonials: 'Testimonials',
      projects: 'Projects',
      blog: 'Blog',
      media: 'Media',
      analytics: 'Analytics',
      users: 'Users',
      settings: 'Settings',
      admin: 'Admin Console',
      roles: 'Manage Roles',
      resources: 'Resources',
      branches: 'Branches',
      'theme-builder': 'Theme Builder',
      notifications: 'Notifications',
      'audit-logs': 'Audit Logs',
      'system-health': 'System Health',
      'cms-builder': 'CMS Builder',
      new: 'New',
    };

    return segments.map((seg, idx) => {
      const isLast = idx === segments.length - 1;
      const path = '/' + segments.slice(0, idx + 1).join('/');

      let label = labelMap[seg.toLowerCase()];
      if (!label) {
        if (/^[0-9a-fA-F-]+$/.test(seg) && seg.length > 8) {
          label = 'Details';
        } else {
          label = this.capitalize(seg.replace(/-/g, ' '));
        }
      }

      return {
        label: label,
        route: isLast ? '' : path,
      };
    });
  }

  getInitials(name?: string): string {
    if (!name) return 'Z';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
