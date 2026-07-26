import {
  Component,
  OnInit,
  signal,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MenuComponent } from './menu/menu.component';
import { MenuService } from '../../core/menu/menu.service';
import { MenuNode } from '../models/menu.model';

/**
 * Sidebar Component
 * Integrates dynamic menu system with responsive collapse and favorites
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, MenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Mobile sidebar toggle button -->
    <button
      (click)="toggleSidebar()"
      class="sidebar-mobile-toggle"
      [attr.aria-label]="'Toggle sidebar'"
      type="button"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <!-- Sidebar Container -->
    <aside
      class="sidebar"
      [class.sidebar-open]="isSidebarOpen()"
      [class.sidebar-collapsed]="isCollapsed()"
      role="navigation"
      [attr.aria-label]="'Application navigation'"
    >
      <!-- Header with Logo and Toggle -->
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="24" height="24" rx="4" fill="currentColor" />
          </svg>
          <span *ngIf="!isCollapsed()" class="logo-text">ZCC</span>
        </div>

        <!-- Collapse toggle -->
        <button
          (click)="toggleCollapse()"
          class="sidebar-collapse-btn"
          [attr.aria-label]="isCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="15 18 8 12 15 6"></polyline>
            <polyline points="4 18 11 12 4 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- Main Menu -->
      <nav class="sidebar-menu" role="navigation" [attr.aria-label]="'Main navigation'">
        <app-menu
          [items]="menuItems()"
          [collapsed]="isCollapsed()"
          [showFavoriteButton]="true"
          (itemSelected)="onMenuItemSelected($event)"
          (favoriteToggled)="onFavoriteToggled($event)"
        ></app-menu>
      </nav>

      <!-- Favorites Section -->
      <div *ngIf="!isCollapsed() && favoriteMenus().length" class="sidebar-section">
        <div class="sidebar-section-title">Favorites</div>
        <div class="sidebar-section-content">
          <app-menu
            [items]="favoriteMenus()"
            [collapsed]="isCollapsed()"
            [level]="1"
            [showFavoriteButton]="false"
            (itemSelected)="onMenuItemSelected($event)"
            (favoriteToggled)="onFavoriteToggled($event)"
          ></app-menu>
        </div>
      </div>

      <!-- Recently Used Section -->
      <div *ngIf="!isCollapsed() && recentMenus().length" class="sidebar-section">
        <div class="sidebar-section-title">Recent</div>
        <div class="sidebar-section-content">
          <app-menu
            [items]="(recentMenus() | slice : 0 : 5)"
            [collapsed]="isCollapsed()"
            [level]="1"
            [showFavoriteButton]="false"
            (itemSelected)="onMenuItemSelected($event)"
            (favoriteToggled)="onFavoriteToggled($event)"
          ></app-menu>
        </div>
      </div>

      <!-- User Section -->
      <div *ngIf="!isCollapsed()" class="sidebar-footer">
        <button class="sidebar-user-btn" type="button">
          <div class="sidebar-avatar">U</div>
          <span class="sidebar-user-info">
            <span class="sidebar-user-name">User</span>
            <span class="sidebar-user-role">Admin</span>
          </span>
        </button>
      </div>
    </aside>

    <!-- Sidebar overlay (mobile) -->
    <div
      *ngIf="isSidebarOpen()"
      class="sidebar-overlay"
      (click)="closeSidebar()"
    ></div>
  `,
  styles: [
    `
      :host {
        --sidebar-width: 16rem;
        --sidebar-collapsed-width: 4.5rem;
        --sidebar-bg: #ffffff;
        --sidebar-text: #1f2937;
        --sidebar-border: #e5e7eb;
        --sidebar-accent: #3b82f6;

        @media (prefers-color-scheme: dark) {
          --sidebar-bg: #1f2937;
          --sidebar-text: #e5e7eb;
          --sidebar-border: #374151;
          --sidebar-accent: #60a5fa;
        }
      }

      .sidebar-mobile-toggle {
        display: none;
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 40;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        background: var(--sidebar-accent);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;

        @media (max-width: 768px) {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        &:hover {
          box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2);
        }
      }

      .sidebar {
        display: flex;
        flex-direction: column;
        position: fixed;
        left: 0;
        top: 0;
        height: 100vh;
        width: var(--sidebar-width);
        background: var(--sidebar-bg);
        border-right: 1px solid var(--sidebar-border);
        transition: width 0.3s ease;
        z-index: 30;
        overflow-y: auto;

        @media (max-width: 768px) {
          width: 100%;
          max-width: var(--sidebar-width);
          transform: translateX(-100%);
          transition: transform 0.3s ease;

          &.sidebar-open {
            transform: translateX(0);
          }
        }

        &.sidebar-collapsed {
          width: var(--sidebar-collapsed-width);

          .logo-text,
          .sidebar-section-title,
          .sidebar-user-info {
            display: none;
          }

          .sidebar-collapse-btn svg {
            transform: scaleX(-1);
          }
        }
      }

      .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 20;

        @media (max-width: 768px) {
          display: block;
        }
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        border-bottom: 1px solid var(--sidebar-border);
        flex-shrink: 0;
      }

      .sidebar-logo {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--sidebar-accent);
        font-weight: 700;
        font-size: 1.25rem;
      }

      .logo-text {
        color: var(--sidebar-text);
      }

      .sidebar-collapse-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: none;
        background: transparent;
        color: var(--sidebar-text);
        cursor: pointer;
        border-radius: 0.375rem;
        transition: all 0.2s ease;

        &:hover {
          background: var(--sidebar-border);
        }

        &:focus-visible {
          outline: 2px solid var(--sidebar-accent);
          outline-offset: 2px;
        }

        svg {
          transition: transform 0.3s ease;
        }
      }

      .sidebar-menu {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem 0;
      }

      .sidebar-section {
        padding: 0.75rem 0;
        border-top: 1px solid var(--sidebar-border);
      }

      .sidebar-section-title {
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #9ca3af;
      }

      .sidebar-section-content {
        padding: 0.5rem 0;
      }

      .sidebar-footer {
        padding: 1rem;
        border-top: 1px solid var(--sidebar-border);
        flex-shrink: 0;
      }

      .sidebar-user-btn {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--sidebar-border);
        border-radius: 0.375rem;
        background: transparent;
        color: var(--sidebar-text);
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: var(--sidebar-border);
        }

        &:focus-visible {
          outline: 2px solid var(--sidebar-accent);
          outline-offset: -2px;
        }
      }

      .sidebar-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        background: var(--sidebar-accent);
        color: white;
        font-weight: 600;
        flex-shrink: 0;
      }

      .sidebar-user-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        text-align: left;
      }

      .sidebar-user-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--sidebar-text);
      }

      .sidebar-user-role {
        font-size: 0.75rem;
        color: #9ca3af;
      }

      .sidebar-menu::-webkit-scrollbar {
        width: 0.5rem;
      }

      .sidebar-menu::-webkit-scrollbar-track {
        background: transparent;
      }

      .sidebar-menu::-webkit-scrollbar-thumb {
        background: var(--sidebar-border);
        border-radius: 0.25rem;

        &:hover {
          background: #d1d5db;
        }
      }
    `,
  ],
})
export class SidebarComponent implements OnInit {
  isSidebarOpen = signal(false);
  isCollapsed = signal(false);
  menuItems = signal<MenuNode[]>([]);
  favoriteMenus = signal<MenuNode[]>([]);
  recentMenus = signal<MenuNode[]>([]);

  private isInitialized = false;

  constructor(private menuService: MenuService) {
    effect(() => {
      this.menuItems.set(this.menuService.menu());
      this.favoriteMenus.set(this.menuService.favoriteMenus());
      this.recentMenus.set(this.menuService.recentMenus());
    });
  }

  ngOnInit(): void {
    if (!this.isInitialized) {
      this.loadMenuData();
      this.isInitialized = true;
    }
  }

  private async loadMenuData(): Promise<void> {
    try {
      await this.menuService.loadMenuTree();
      await this.menuService.loadFavorites();
      await this.menuService.loadRecent();
    } catch (error) {
      console.error('Failed to load menu data', error);
    }
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  toggleCollapse(): void {
    this.isCollapsed.update(v => !v);
    localStorage.setItem('sidebar-collapsed', this.isCollapsed().toString());
  }

  onMenuItemSelected(item: MenuNode): void {
    this.closeSidebar();
    this.menuService.trackMenuAccess(item.id);
  }

  async onFavoriteToggled(item: MenuNode): Promise<void> {
    try {
      await this.menuService.toggleFavorite(item.id);
    } catch (error) {
      console.error('Failed to toggle favorite', error);
    }
  }
}
