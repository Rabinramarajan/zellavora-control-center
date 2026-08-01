import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'zcc-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <p class="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-8xl font-black tracking-tight text-transparent">
        404
      </p>
      <h1 class="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Page not found</h1>
      <p class="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        routerLink="/dashboard"
        class="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
      >
        <i class="pi pi-arrow-left text-xs" aria-hidden="true"></i>
        Back to dashboard
      </a>
    </div>
  `,
})
export class NotFoundComponent {}
