import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="h-screen w-screen overflow-hidden flex bg-[#03020c] text-slate-100 font-sans">
      <!-- Sidebar (left side, fixed) -->
      <div class="hidden md:block w-64 shrink-0 bg-[#05040e]">
        <app-sidebar></app-sidebar>
      </div>

      <!-- Main Column Container (Header + Content area, right side) -->
      <div class="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
        <!-- Top Header / Navbar -->
        <app-navbar class="shrink-0"></app-navbar>

        <!-- Main Content (Scrolls vertically) -->
        <main class="flex-1 overflow-y-auto bg-[#03020c]">
          <div class="p-6">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>

      <!-- Mobile Sidebar overlay -->
      <div class="md:hidden">
        <app-sidebar></app-sidebar>
      </div>
    </div>
  `,
  styles: [],
})
export class AdminLayoutComponent {}
