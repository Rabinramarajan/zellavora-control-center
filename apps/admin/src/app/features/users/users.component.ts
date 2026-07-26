import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="p-8"><h1 class="text-2xl font-bold">User Management</h1><p class="text-slate-600 mt-2">Coming soon...</p></div>`,
})
export class UsersComponent {}
