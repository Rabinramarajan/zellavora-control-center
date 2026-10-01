import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';

import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuNode } from '../../models';
import { LayoutService } from '../../../core/services/layout.service';

/**
 * Recursive sidebar menu node. Renders a backend-driven menu tree:
 *  - A node with children becomes an expandable group (section header when it
 *    has no route of its own, a navigable parent otherwise).
 *  - A leaf renders a router link.
 */
@Component({
  selector: 'app-sidebar-nav-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar-nav-node.component.html',
  styleUrl: './sidebar-nav-node.component.scss',
})
export class SidebarNavNodeComponent {
  node = input.required<MenuNode>();
  collapsed = input(false);

  readonly expanded = signal(false);
  // Fixed positioning escapes the sidebar's scroll container, which would clip an absolute tooltip.
  readonly tooltipTop = signal<number | null>(null);
  readonly tooltipLeft = signal(0);

  private readonly layoutService = inject(LayoutService);

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  showTooltip(event: Event): void {
    if (!this.collapsed()) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.tooltipTop.set(rect.top + rect.height / 2);
    this.tooltipLeft.set(rect.right + 10);
  }

  hideTooltip(): void {
    this.tooltipTop.set(null);
  }

  closeOnMobile(): void {
    this.hideTooltip();
    if (window.innerWidth < 768) {
      this.layoutService.closeSidebar();
    }
  }
}
