import { Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'zcc-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  private readonly baseItems = signal<NavItem[]>([
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Authentication', path: '/authentication' },
    { label: 'Profile', path: '/profile' },
    { label: 'Developer', path: '/developer' },
    { label: 'AI Assistant', path: '/ai-assistant' },
  ]);

  readonly navItems = computed(() => this.baseItems());
}
