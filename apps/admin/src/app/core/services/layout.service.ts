import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  isSidebarOpen = signal(false);
  isSidebarCollapsed = signal(false);

  toggleSidebar(): void {
    if (window.innerWidth >= 768) {
      this.isSidebarCollapsed.update((v) => !v);
    } else {
      this.isSidebarOpen.update((v) => !v);
    }
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  openSidebar(): void {
    this.isSidebarOpen.set(true);
  }

  toggleDesktopCollapse(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }
}
