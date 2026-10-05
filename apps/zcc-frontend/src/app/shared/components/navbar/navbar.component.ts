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
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { PermissionService } from '../../../core/rbac/services/permission.service';
import { AppDialogService } from '../dialog';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { firstValueFrom } from 'rxjs';
import { UserRole } from '../../models';
import { LayoutService } from '../../../core/services/layout/layout.service';
import { BreadcrumbComponent } from '../breadcrumb';

type AccountMenuIcon = 'profile' | 'settings' | 'security' | 'sessions';

interface AccountMenuItem {
  label: string;
  caption: string;
  route: string;
  icon: AccountMenuIcon;
}

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterLink, ThemeToggleComponent, BreadcrumbComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  auth = inject(AuthService);
  layoutService = inject(LayoutService);
  private readonly dialog = inject(AppDialogService);
  private readonly permissions = inject(PermissionService);

  isUserMenuOpen = signal(false);
  avatarFailed = signal(false);
  avatarSrc = computed(() => this.auth.user()?.avatarUrl || 'assets/rabin_avatar.jpg');
  displayName = computed(() => this.auth.user()?.fullName || 'Rabin R');
  displayRole = computed(() =>
    this.auth.user()?.role === UserRole.INDIVIDUAL
      ? 'Individual Account'
      : this.auth.user()?.role || 'Super Admin'
  );

  /** The signed-in person's own account; organization-wide controls stay in the sidebar. */
  accountMenu = computed<AccountMenuItem[]>(() => {
    const items: AccountMenuItem[] = [];
    if (this.permissions.canSync('portfolio:read')) {
      items.push({
        label: 'My Profile',
        caption: 'Your public profile',
        route: '/portfolio/profile',
        icon: 'profile',
      });
    }
    items.push(
      {
        label: 'Account Settings',
        caption: 'Name, photo & preferences',
        route: '/settings/profile',
        icon: 'settings',
      },
      {
        label: 'Security',
        caption: 'Password & 2FA',
        route: '/account/security',
        icon: 'security',
      },
      {
        label: 'Active Sessions',
        caption: 'Devices signed in',
        route: '/account/sessions',
        icon: 'sessions',
      }
    );
    return items;
  });

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

  getInitials(name?: string): string {
    if (!name) return 'Z';
    return name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
