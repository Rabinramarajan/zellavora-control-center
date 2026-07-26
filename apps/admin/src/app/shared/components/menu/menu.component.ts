import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  SecurityContext,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MenuNode } from '../../models/menu.model';

/**
 * Recursive Menu Component
 * Renders menu items with support for unlimited nesting, icons, badges, and favorites
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="menu-list" [class.menu-collapsed]="collapsed()" [attr.aria-label]="label">
      <li
        *ngFor="let item of items; trackBy: trackByItemId"
        class="menu-item"
        [attr.data-key]="item.key"
        [attr.data-id]="item.id"
      >
        <!-- Menu Item Wrapper -->
        <div class="menu-item-wrapper">
          <!-- Link for leaf items with routes -->
          <ng-container *ngIf="item.route && !item.children.length; else itemButton">
            <a
              [routerLink]="item.route"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: false }"
              (click)="onItemClick(item)"
              class="menu-link"
              [attr.aria-label]="item.label"
              [title]="item.title || item.label"
            >
              <!-- Icon -->
              <span
                *ngIf="item.icon"
                class="menu-icon"
                [innerHTML]="sanitizeHtml(item.icon)"
              ></span>

              <!-- Label -->
              <span *ngIf="!collapsed() || !item.route" class="menu-label">
                {{ item.label }}
              </span>

              <!-- Badge -->
              <span
                *ngIf="item.badge && !collapsed()"
                [class]="'menu-badge badge-' + (item.badge.style || 'default')"
                [class.badge-animated]="item.badge.animated"
              >
                {{ item.badge.value || item.badge.icon }}
              </span>
            </a>
          </ng-container>

          <!-- Button for parent items -->
          <ng-template #itemButton>
            <button
              class="menu-button"
              (click)="toggleExpanded(item.id)"
              [attr.aria-expanded]="isExpanded(item.id)"
              [attr.aria-label]="'Toggle ' + item.label"
              type="button"
            >
              <!-- Icon -->
              <span
                *ngIf="item.icon"
                class="menu-icon"
                [innerHTML]="sanitizeHtml(item.icon)"
              ></span>

              <!-- Label -->
              <span *ngIf="!collapsed()" class="menu-label">
                {{ item.label }}
              </span>

              <!-- Toggle indicator -->
              <span *ngIf="item.children.length" class="menu-toggle">
                <svg
                  class="toggle-arrow"
                  [class.rotated]="isExpanded(item.id)"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M6 5L10 9L6 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </span>

              <!-- Badge -->
              <span
                *ngIf="item.badge && !collapsed()"
                [class]="'menu-badge badge-' + (item.badge.style || 'default')"
                [class.badge-animated]="item.badge.animated"
              >
                {{ item.badge.value || item.badge.icon }}
              </span>
            </button>
          </ng-template>

          <!-- Favorite button -->
          <button
            *ngIf="!collapsed() && showFavoriteButton"
            class="menu-favorite"
            [class.favorited]="item.isFavorite"
            (click)="toggleFavorite(item, $event)"
            [attr.aria-label]="'Toggle favorite for ' + item.label"
            type="button"
            title="Add to favorites"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 1L10.39 6.26H16L11.31 9.74L13.7 15H8L3.29 11.26L8.98 7.78L3.7 1H8Z"
              />
            </svg>
          </button>
        </div>

        <!-- Children (recursive) -->
        <app-menu
          *ngIf="item.children.length && isExpanded(item.id)"
          [items]="item.children"
          [collapsed]="collapsed()"
          [level]="level + 1"
          [showFavoriteButton]="showFavoriteButton"
          class="menu-children"
          (itemSelected)="onChildItemSelected($event)"
          (favoriteToggled)="onChildFavoriteToggled($event)"
        ></app-menu>
      </li>
    </ul>
  `,
  styles: [
    `
      .menu-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0;

        &.menu-collapsed {
          .menu-label,
          .menu-badge,
          .menu-favorite {
            display: none;
          }
        }
      }

      .menu-item {
        position: relative;
      }

      .menu-item-wrapper {
        display: flex;
        align-items: center;
        gap: 0;
        position: relative;
      }

      .menu-link,
      .menu-button {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.75rem;
        border-radius: 0.375rem;
        transition: all 0.2s ease;
        cursor: pointer;
        border: none;
        background: transparent;
        color: inherit;
        font: inherit;
        text-decoration: none;
        text-align: left;

        &:hover {
          background-color: var(--color-menu-hover, #f3f4f6);
        }

        &:focus-visible {
          outline: 2px solid var(--color-focus, #3b82f6);
          outline-offset: -2px;
        }

        &.active {
          background-color: var(--color-menu-active, #dbeafe);
          color: var(--color-menu-active-text, #1e40af);
          font-weight: 500;

          .menu-icon {
            color: var(--color-menu-active-text, #1e40af);
          }
        }
      }

      .menu-link {
        width: 100%;
      }

      .menu-button {
        width: 100%;
      }

      .menu-icon {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-menu-icon, #6b7280);

        svg {
          width: 100%;
          height: 100%;
        }
      }

      .menu-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.875rem;
        color: var(--color-menu-text, #1f2937);
      }

      .menu-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        margin-left: auto;

        .toggle-arrow {
          transition: transform 0.2s ease;

          &.rotated {
            transform: rotate(90deg);
          }
        }
      }

      .menu-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.5rem;
        height: 1.5rem;
        padding: 0 0.375rem;
        border-radius: 9999px;
        font-size: 0.625rem;
        font-weight: 600;
        flex-shrink: 0;
        margin-left: 0.5rem;
        background-color: #e5e7eb;
        color: #374151;
        white-space: nowrap;

        &.badge-success {
          background-color: #dcfce7;
          color: #166534;
        }

        &.badge-danger {
          background-color: #fee2e2;
          color: #991b1b;
        }

        &.badge-warning {
          background-color: #fef3c7;
          color: #92400e;
        }

        &.badge-info {
          background-color: #dbeafe;
          color: #1e40af;
        }

        &.badge-animated {
          animation: badge-pulse 2s ease-in-out infinite;
        }
      }

      .menu-favorite {
        opacity: 0;
        transition: opacity 0.2s ease;
        padding: 0.25rem;
        border: none;
        background: transparent;
        cursor: pointer;
        color: #9ca3af;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.75rem;
        flex-shrink: 0;

        &:hover {
          opacity: 1;
          color: #f59e0b;
        }

        &.favorited {
          opacity: 1;
          color: #fbbf24;
        }

        &:focus-visible {
          outline: 2px solid var(--color-focus, #3b82f6);
          outline-offset: -2px;
        }
      }

      .menu-item-wrapper:hover .menu-favorite {
        opacity: 1;
      }

      .menu-children {
        margin-left: var(--menu-indent, 1rem);
        border-left: 1px solid var(--color-menu-border, #e5e7eb);
        padding-left: 0;
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      @keyframes badge-pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .menu-link,
        .menu-button {
          &:hover {
            background-color: var(--color-menu-hover, #374151);
          }

          &.active {
            background-color: var(--color-menu-active, #1e3a8a);
            color: var(--color-menu-active-text, #93c5fd);
          }
        }

        .menu-label {
          color: var(--color-menu-text, #e5e7eb);
        }

        .menu-icon {
          color: var(--color-menu-icon, #9ca3af);
        }

        .menu-badge {
          background-color: #4b5563;
          color: #e5e7eb;

          &.badge-success {
            background-color: #064e3b;
            color: #dcfce7;
          }

          &.badge-danger {
            background-color: #7f1d1d;
            color: #fee2e2;
          }

          &.badge-warning {
            background-color: #78350f;
            color: #fef3c7;
          }

          &.badge-info {
            background-color: #082f49;
            color: #dbeafe;
          }
        }

        .menu-children {
          border-left-color: var(--color-menu-border, #4b5563);
        }
      }
    `,
  ],
})
export class MenuComponent {
  @Input() items: MenuNode[] = [];
  @Input() collapsed = signal(false);
  @Input() level = 0;
  @Input() label = 'Menu';
  @Input() showFavoriteButton = true;

  @Output() itemSelected = new EventEmitter<MenuNode>();
  @Output() favoriteToggled = new EventEmitter<MenuNode>();

  protected expandedIds = signal<Set<string>>(new Set());

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Check if menu item is expanded
   */
  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  /**
   * Toggle menu item expansion
   */
  toggleExpanded(id: string): void {
    this.expandedIds.update(set => {
      const newSet = new Set(set);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  }

  /**
   * Handle menu item click
   */
  onItemClick(item: MenuNode): void {
    this.itemSelected.emit(item);
  }

  /**
   * Handle child item selection
   */
  onChildItemSelected(item: MenuNode): void {
    this.itemSelected.emit(item);
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(item: MenuNode, event: Event): void {
    event.stopPropagation();
    this.favoriteToggled.emit(item);
  }

  /**
   * Handle child favorite toggle
   */
  onChildFavoriteToggled(item: MenuNode): void {
    this.favoriteToggled.emit(item);
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.sanitize(SecurityContext.HTML, html) || '';
  }

  /**
   * TrackBy function for ngFor optimization
   */
  trackByItemId(_index: number, item: MenuNode): string {
    return item.id;
  }
}
