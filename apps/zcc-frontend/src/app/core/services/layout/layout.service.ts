import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

/** Matches the `md` breakpoint (768px) used in the layout CSS. */
const DESKTOP_QUERY = '(min-width: 768px)';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly win = inject(DOCUMENT).defaultView;

  private readonly _isSidebarOpen = signal(false); // mobile drawer
  private readonly _isSidebarCollapsed = signal(false); // desktop rail

  readonly isSidebarOpen = this._isSidebarOpen.asReadonly();
  readonly isSidebarCollapsed = this._isSidebarCollapsed.asReadonly();

  toggleSidebar(): void {
    const target = this.isDesktop() ? this._isSidebarCollapsed : this._isSidebarOpen;
    target.update((v) => !v);
  }

  closeSidebar(): void {
    this._isSidebarOpen.set(false);
  }

  private isDesktop(): boolean {
    return this.win?.matchMedia(DESKTOP_QUERY).matches ?? false;
  }
}