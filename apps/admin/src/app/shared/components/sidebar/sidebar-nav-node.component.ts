import { Component, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuNode } from '@shared/models';
import { LayoutService } from '@core/services/layout.service';

/**
 * Recursive sidebar menu node. Renders a backend-driven menu tree:
 *  - A node with children becomes an expandable group (section header when it
 *    has no route of its own, a navigable parent otherwise).
 *  - A leaf renders a router link.
 */
@Component({
  selector: 'app-sidebar-nav-node',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    @if (node().children.length > 0) {
      <!-- Group -->
      <button
        type="button"
        (click)="toggle()"
        [class.justify-center]="collapsed()"
        [class.w-full]="!collapsed()"
        class="flex items-center justify-between px-3 py-2 rounded-xl text-[#a3a1b8] hover:bg-[#13112b]/50 hover:text-white transition-all text-xs font-semibold cursor-pointer"
        [attr.aria-expanded]="expanded()"
      >
        <div class="flex items-center gap-3">
          <span class="text-base shrink-0">{{ node().icon }}</span>
          <span *ngIf="!collapsed()">{{ node().label }}</span>
        </div>
        <span
          *ngIf="!collapsed()"
          class="text-[9px] text-[#4e4b70] transition-transform duration-200"
          [class.rotate-90]="expanded()"
        >&#9654;</span>
      </button>

      @if (expanded() && !collapsed()) {
        <div class="pl-3.5 pr-1 py-1 space-y-1 border-l border-[#13112b] ml-5">
          @for (child of node().children; track child.id) {
            <app-sidebar-nav-node [node]="child" [collapsed]="collapsed()" />
          }
        </div>
      }
    } @else {
      <!-- Leaf -->
      <a
        [routerLink]="node().route"
        routerLinkActive="bg-[#13112b] text-white"
        (click)="closeOnMobile()"
        [class.justify-center]="collapsed()"
        class="flex items-center justify-between px-3 py-2 rounded-xl text-[#a3a1b8] hover:bg-[#13112b]/50 hover:text-white transition-all text-xs font-semibold cursor-pointer"
      >
        <div class="flex items-center gap-3">
          <span class="text-base shrink-0">{{ node().icon }}</span>
          <span *ngIf="!collapsed()">{{ node().label }}</span>
        </div>
      </a>
    }
  `,
})
export class SidebarNavNodeComponent {
  node = input.required<MenuNode>();
  collapsed = input(false);

  readonly expanded = signal(false);

  private readonly layoutService = inject(LayoutService);

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  closeOnMobile(): void {
    if (window.innerWidth < 768) {
      this.layoutService.closeSidebar();
    }
  }
}
