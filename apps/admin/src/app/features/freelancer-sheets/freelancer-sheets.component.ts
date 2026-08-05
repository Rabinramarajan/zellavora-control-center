import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { SheetsStore } from './sheets.store';

@Component({
  selector: 'app-freelancer-sheets',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
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
        <button mat-raised-button color="primary" (click)="createDailySheet()" class="gap-2">
          <mat-icon>add</mat-icon>
          New Daily Sheet
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="p-4">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Pending Approval</div>
          <div class="text-3xl font-bold mt-2">{{ pendingCount }}</div>
          <p class="text-xs text-gray-500 mt-1">Daily sheets awaiting approval</p>
        </mat-card>

        <mat-card class="p-4">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">This Month</div>
          <div class="text-3xl font-bold mt-2">{{ thisMonthHours }}h</div>
          <p class="text-xs text-gray-500 mt-1">Hours logged this month</p>
        </mat-card>

        <mat-card class="p-4">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Approved</div>
          <div class="text-3xl font-bold mt-2">{{ approvedCount }}</div>
          <p class="text-xs text-gray-500 mt-1">Approved timesheets</p>
        </mat-card>
      </div>

      <!-- Tabs -->
      <mat-tab-group>
        <mat-tab label="Daily Sheets">
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">calendar_today</mat-icon>
            Daily Sheets
          </ng-template>
          <router-outlet></router-outlet>
        </mat-tab>

        <mat-tab label="Monthly Sheets">
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">calendar_month</mat-icon>
            Monthly Sheets
          </ng-template>
          <!-- Monthly sheets content -->
        </mat-tab>

        <mat-tab label="Approval Queue">
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">check_circle</mat-icon>
            Approval Queue
          </ng-template>
          <!-- Approval content -->
        </mat-tab>
      </mat-tab-group>
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
