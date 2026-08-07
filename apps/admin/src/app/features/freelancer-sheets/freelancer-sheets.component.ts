import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SheetsStore } from './sheets.store';

@Component({
  selector: 'app-freelancer-sheets',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
  ],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-3xl font-bold">Freelancer Timesheet System</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Track your work with daily and monthly timesheets
          </p>
        </div>
        <button (click)="createDailySheet()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2">
          ➕ New Daily Sheet
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Pending Approval</div>
          <div class="text-3xl font-bold mt-2">{{ pendingCount }}</div>
          <p class="text-xs text-gray-500 mt-1">Daily sheets awaiting approval</p>
        </div>

        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">This Month</div>
          <div class="text-3xl font-bold mt-2">{{ thisMonthHours }}h</div>
          <p class="text-xs text-gray-500 mt-1">Hours logged this month</p>
        </div>

        <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Approved</div>
          <div class="text-3xl font-bold mt-2">{{ approvedCount }}</div>
          <p class="text-xs text-gray-500 mt-1">Approved timesheets</p>
        </div>
      </div>

      <!-- Tabs using Tailwind -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="flex border-b border-gray-200 dark:border-gray-800">
          <button class="px-4 py-3 font-semibold border-b-2 border-purple-600 text-purple-600 dark:text-purple-400">
            📅 Daily Sheets
          </button>
          <button class="px-4 py-3 font-semibold border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300">
            📊 Monthly Sheets
          </button>
          <button class="px-4 py-3 font-semibold border-b-2 border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300">
            ✓ Approval Queue
          </button>
        </div>
        <div class="p-4">
          <p class="text-gray-600 dark:text-gray-400">Tab content will be implemented in child components.</p>
          <router-outlet></router-outlet>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 2rem;
    }
  `],
})
export class FreelancerSheetsComponent implements OnInit {
  private store = inject(SheetsStore);
  private router = inject(Router);

  pendingCount = 0;
  thisMonthHours = 0;
  approvedCount = 0;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    this.store.loadDailySheets({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    });

    this.store.loadMonthlySheets({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    });

    // Calculate stats
    this.pendingCount = this.store.dailySheets()
      .filter(s => s.status === 'submitted').length;

    this.approvedCount = this.store.dailySheets()
      .filter(s => s.status === 'approved').length;

    this.thisMonthHours = this.store.dailySheets()
      .reduce((sum, s) => sum + s.hoursWorked, 0);
  }

  createDailySheet() {
    this.router.navigate(['/freelancer-sheets/daily/new']);
  }
}
