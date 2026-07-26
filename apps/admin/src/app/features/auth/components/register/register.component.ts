import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-slate-100">
      <div class="text-center">
        <h1 class="text-2xl font-bold">Register</h1>
        <p class="text-slate-600 mt-2">Registration feature coming soon</p>
        <a routerLink="/auth/login" class="mt-4 inline-block text-blue-600 hover:text-blue-700">
          Back to Login
        </a>
      </div>
    </div>
  `,
})
export class RegisterComponent {}
