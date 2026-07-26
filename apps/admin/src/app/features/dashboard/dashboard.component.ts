import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <!-- Header -->
      <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 class="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p class="text-slate-600 dark:text-slate-400 mt-1">Welcome to Zellavora Control Center</p>
        </div>
      </div>

      <!-- Content -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <!-- Welcome Card -->
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 mb-8">
          <div class="flex items-center gap-6">
            <div class="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
              <span class="text-3xl">🚀</span>
            </div>
            <div>
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Welcome to Zellavora Control Center
              </h2>
              <p class="text-slate-600 dark:text-slate-400">
                Your enterprise CMS and administration platform is ready. Manage your portfolio, projects, blog, and more!
              </p>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
            <p class="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Projects</p>
            <p class="text-4xl font-bold text-slate-900 dark:text-white mt-2">0</p>
            <a routerLink="/projects" class="text-blue-600 hover:text-blue-700 text-sm mt-4 inline-block">
              View Projects →
            </a>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
            <p class="text-slate-600 dark:text-slate-400 text-sm font-medium">Blog Posts</p>
            <p class="text-4xl font-bold text-slate-900 dark:text-white mt-2">0</p>
            <a routerLink="/blog" class="text-blue-600 hover:text-blue-700 text-sm mt-4 inline-block">
              Manage Blog →
            </a>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
            <p class="text-slate-600 dark:text-slate-400 text-sm font-medium">Media Files</p>
            <p class="text-4xl font-bold text-slate-900 dark:text-white mt-2">0</p>
            <a routerLink="/media" class="text-blue-600 hover:text-blue-700 text-sm mt-4 inline-block">
              Media Library →
            </a>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
            <p class="text-slate-600 dark:text-slate-400 text-sm font-medium">Visitors</p>
            <p class="text-4xl font-bold text-slate-900 dark:text-white mt-2">0</p>
            <a routerLink="/analytics" class="text-blue-600 hover:text-blue-700 text-sm mt-4 inline-block">
              Analytics →
            </a>
          </div>
        </div>

        <!-- Quick Access -->
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
          <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-6">Quick Access</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a routerLink="/portfolio" class="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <span class="text-2xl">👤</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">Portfolio</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Manage your profile</p>
              </div>
            </a>

            <a routerLink="/projects" class="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <span class="text-2xl">💼</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">Projects</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Create & edit projects</p>
              </div>
            </a>

            <a routerLink="/blog" class="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <span class="text-2xl">📝</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">Blog</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Write & publish articles</p>
              </div>
            </a>

            <a routerLink="/media" class="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <span class="text-2xl">🖼️</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">Media</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Manage files & images</p>
              </div>
            </a>

            <a routerLink="/analytics" class="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <span class="text-2xl">📊</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">Analytics</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">View insights & stats</p>
              </div>
            </a>

            <a routerLink="/settings" class="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
              <span class="text-2xl">⚙️</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">Settings</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">Configure system</p>
              </div>
            </a>
          </div>
        </div>

        <!-- Info Box -->
        <div class="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-xl p-6">
          <h4 class="font-bold text-blue-900 dark:text-blue-200 mb-2">🎯 Getting Started</h4>
          <ul class="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Complete your profile information in Portfolio section</li>
            <li>Create your first project to showcase your work</li>
            <li>Write a blog post to share your thoughts</li>
            <li>Upload media files to your media library</li>
            <li>Monitor your portfolio analytics</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class DashboardComponent {}
