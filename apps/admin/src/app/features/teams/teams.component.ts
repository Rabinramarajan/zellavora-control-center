import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeamsStore } from './teams.store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatPaginatorModule,
    MatDialogModule,
    MatFormFieldModule,
    MatListModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-3xl font-bold">Teams</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Manage teams and organize your members
          </p>
        </div>
        <button
          mat-raised-button
          color="primary"
          (click)="openCreateTeamDialog()"
          class="gap-2"
        >
          <mat-icon>add</mat-icon>
          New Team
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Teams</div>
          <div class="text-2xl font-bold mt-1">{{ store.totalCount() }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Total Members</div>
          <div class="text-2xl font-bold mt-1">{{ store.totalMembers() }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Avg per Team</div>
          <div class="text-2xl font-bold mt-1">
            {{ (store.totalMembers() / (store.totalCount() || 1)) | number: '1.0-0' }}
          </div>
        </div>
      </div>

      <!-- Search & Filter -->
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <mat-form-field appearance="outline" class="w-full md:col-span-2">
            <mat-label>Search teams</mat-label>
            <input
              matInput
              [(ngModel)]="searchQuery"
              (ngModelChange)="store.setSearchQuery($event)"
              placeholder="Search by name or description..."
            />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Sort by</mat-label>
            <mat-select
              [(value)]="selectedSort"
              (selectionChange)="store.setSortBy($event.value)"
            >
              <mat-option value="recent">Most Recent</mat-option>
              <mat-option value="name">Name</mat-option>
              <mat-option value="members">Members</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <!-- Loading State -->
      <div
        *ngIf="store.isLoading()"
        class="flex justify-center items-center py-12"
      >
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <!-- Error State -->
      <div
        *ngIf="store.error()"
        class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
      >
        <div class="flex items-start gap-3">
          <mat-icon class="text-red-600">error</mat-icon>
          <div class="flex-1">
            <h3 class="font-medium text-red-800 dark:text-red-200">Error</h3>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">
              {{ store.error() }}
            </p>
          </div>
          <button
            mat-icon-button
            (click)="store.clearError()"
            class="ml-auto"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div
        *ngIf="!store.isLoading() && store.filteredItems().length === 0"
        class="text-center py-12"
      >
        <mat-icon class="text-6xl text-gray-300 mb-4">group_off</mat-icon>
        <h3 class="text-xl font-medium text-gray-600 dark:text-gray-400">
          No teams found
        </h3>
        <p class="text-gray-500 dark:text-gray-500 mt-2">
          Create your first team to organize members
        </p>
      </div>

      <!-- Teams Grid -->
      <div
        *ngIf="!store.isLoading() && store.filteredItems().length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <mat-card
          *ngFor="let team of store.filteredItems()"
          class="cursor-pointer hover:shadow-lg transition-shadow"
        >
          <mat-card-header>
            <div class="flex items-start justify-between w-full">
              <div class="flex-1">
                <h3 class="font-bold text-lg flex items-center gap-2">
                  <mat-icon class="text-primary">group</mat-icon>
                  {{ team.name }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ team.description || 'No description' }}
                </p>
              </div>
              <button mat-icon-button [matMenuTriggerFor]="menu">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item (click)="editTeam(team)">
                  <mat-icon>edit</mat-icon>
                  <span>Edit</span>
                </button>
                <button mat-menu-item (click)="viewMembers(team)">
                  <mat-icon>people</mat-icon>
                  <span>View Members</span>
                </button>
                <mat-divider></mat-divider>
                <button
                  mat-menu-item
                  color="warn"
                  (click)="deleteTeam(team.id)"
                >
                  <mat-icon>delete</mat-icon>
                  <span>Delete</span>
                </button>
              </mat-menu>
            </div>
          </mat-card-header>

          <mat-card-content class="pt-4">
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center gap-2">
                <mat-icon class="text-gray-500">people</mat-icon>
                <span class="text-gray-600 dark:text-gray-400">
                  {{ team.memberCount }} members
                </span>
              </div>
              <div class="text-gray-500 dark:text-gray-500">
                {{ team.createdAt | date: 'short' }}
              </div>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button color="primary" (click)="viewMembers(team)">
              <mat-icon>arrow_forward</mat-icon>
              Manage
            </button>
          </mat-card-actions>
        </mat-card>
      </div>

      <!-- Pagination -->
      <mat-paginator
        *ngIf="store.totalPages() > 1"
        [length]="store.totalCount()"
        [pageSize]="store.pageSize()"
        [pageSizeOptions]="[10, 20, 50]"
        (page)="onPageChange($event)"
      ></mat-paginator>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 2rem;
      }
    `,
  ],
})
export class TeamsComponent {
  readonly store = inject(TeamsStore);

  searchQuery = signal('');
  selectedSort = signal<'recent' | 'name' | 'members'>('recent');

  ngOnInit(): void {
    this.store.loadTeams();
  }

  openCreateTeamDialog(): void {
    // TODO: Implement dialog
    console.log('Create team dialog');
  }

  editTeam(team: any): void {
    // TODO: Implement edit
    console.log('Edit team:', team);
  }

  viewMembers(team: any): void {
    // TODO: Navigate to team detail
    console.log('View members:', team);
  }

  deleteTeam(id: string): void {
    if (confirm('Are you sure you want to delete this team?')) {
      this.store.deleteTeam(id);
    }
  }

  onPageChange(event: any): void {
    this.store.setCurrentPage(event.pageIndex + 1);
  }
}
