import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { PortfolioService } from './services/portfolio.service';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  template: `
    <div class="space-y-8">
      <!-- Header -->
      <div>
        <h1 class="text-4xl font-bold text-slate-900 dark:text-white mb-2">
          Portfolio Management
        </h1>
        <p class="text-slate-600 dark:text-slate-400">
          Manage your professional profile, skills, experience, and more
        </p>
      </div>

      <!-- Loading State -->
      <div *ngIf="portfolio.isLoading()" class="flex items-center gap-2 text-slate-600">
        <div class="animate-spin">⏳</div>
        Loading portfolio data...
      </div>

      <!-- Error State -->
      <div
        *ngIf="portfolio.error()"
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300"
      >
        {{ portfolio.error() }}
      </div>

      <!-- Tabs Navigation -->
      <div class="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto pb-4">
        <a
          routerLink="/portfolio/profile"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          👤 Profile
        </a>
        <a
          routerLink="/portfolio/hero"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          🎯 Hero Section
        </a>
        <a
          routerLink="/portfolio/about"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          📖 About
        </a>
        <a
          routerLink="/portfolio/skills"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          ⭐ Skills
        </a>
        <a
          routerLink="/portfolio/experience"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          💼 Experience
        </a>
        <a
          routerLink="/portfolio/education"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          🎓 Education
        </a>
        <a
          routerLink="/portfolio/services"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          🛠️ Services
        </a>
        <a
          routerLink="/portfolio/testimonials"
          routerLinkActive="border-b-2 border-blue-600 text-blue-600"
          class="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
        >
          ⭐ Testimonials
        </a>
      </div>

      <!-- Tab Content -->
      <div class="bg-white dark:bg-slate-800 rounded-xl shadow">
        <router-outlet></router-outlet>
      </div>

      <!-- Quick Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4">
          <p class="text-slate-600 dark:text-slate-400 text-sm">Skills</p>
          <p class="text-3xl font-bold text-slate-900 dark:text-white">
            {{ portfolio.skills().length }}
          </p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4">
          <p class="text-slate-600 dark:text-slate-400 text-sm">Experience</p>
          <p class="text-3xl font-bold text-slate-900 dark:text-white">
            {{ portfolio.experience().length }}
          </p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4">
          <p class="text-slate-600 dark:text-slate-400 text-sm">Education</p>
          <p class="text-3xl font-bold text-slate-900 dark:text-white">
            {{ portfolio.education().length }}
          </p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4">
          <p class="text-slate-600 dark:text-slate-400 text-sm">Services</p>
          <p class="text-3xl font-bold text-slate-900 dark:text-white">
            {{ portfolio.services().length }}
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class PortfolioComponent {
  portfolio = inject(PortfolioService);
}
