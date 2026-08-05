import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsStore } from './projects.store';
import { ProjectStatus } from '@shared/models';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';

@Component({
  selector: 'app-projects',
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
    MatChipsModule,
    MatMenuModule,
    MatPaginatorModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-3xl font-bold">Projects</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Manage all your projects and content
          </p>
        </div>
        <button
          mat-raised-button
          color="primary"
          [routerLink]="['/projects/new']"
          class="gap-2"
        >
          <mat-icon>add</mat-icon>
          New Project
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Total</div>
          <div class="text-2xl font-bold mt-1">{{ store.statusCounts().all }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Draft</div>
          <div class="text-2xl font-bold mt-1 text-blue-600">{{ store.statusCounts().draft }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Published</div>
          <div class="text-2xl font-bold mt-1 text-green-600">{{ store.statusCounts().published }}</div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 font-medium">Archived</div>
          <div class="text-2xl font-bold mt-1 text-gray-600">{{ store.statusCounts().archived }}</div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <mat-form-field appearance="outline" class="w-full">
              <mat-label>Search projects</mat-label>
              <input
                matInput
                [(ngModel)]="searchQuery"
                (ngModelChange)="store.setSearchQuery($event)"
                placeholder="Search by title or description..."
              />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Status</mat-label>
            <mat-select
              [(value)]="selectedStatus"
              (selectionChange)="store.setStatusFilter($event.value)"
            >
              <mat-option value="all">All Projects</mat-option>
              <mat-option value="draft">Draft</mat-option>
              <mat-option value="published">Published</mat-option>
              <mat-option value="archived">Archived</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <div class="flex gap-2 mt-4">
          <mat-form-field appearance="outline" class="w-full md:w-48">
            <mat-label>Sort by</mat-label>
            <mat-select
              [(value)]="selectedSort"
              (selectionChange)="store.setSortBy($event.value)"
            >
              <mat-option value="recent">Most Recent</mat-option>
              <mat-option value="name">Name</mat-option>
              <mat-option value="status">Status</mat-option>
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
          <div>
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
        <mat-icon class="text-6xl text-gray-300 mb-4">folder_off</mat-icon>
        <h3 class="text-xl font-medium text-gray-600 dark:text-gray-400">
          No projects found
        </h3>
        <p class="text-gray-500 dark:text-gray-500 mt-2">
          Create your first project to get started
        </p>
      </div>

      <!-- Projects Grid -->
      <div
        *ngIf="!store.isLoading() && store.filteredItems().length > 0"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <mat-card
          *ngFor="let project of store.filteredItems()"
          class="cursor-pointer hover:shadow-lg transition-shadow"
          [routerLink]="['/projects', project.id]"
        >
          <mat-card-header>
            <div class="flex items-start justify-between w-full">
              <div class="flex-1">
                <h3 class="font-bold text-lg">{{ project.title }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ project.description | slice: 0: 80 }}{{ project.description?.length! > 80 ? '...' : '' }}
                </p>
              </div>
              <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <button mat-menu-item [routerLink]="['/projects', project.id]">
                  <mat-icon>edit</mat-icon>
                  <span>Edit</span>
                </button>
                <button
                  mat-menu-item
                  *ngIf="project.status === 'draft'"
                  (click)="store.publishProject(project.id)"
                >
                  <mat-icon>publish</mat-icon>
                  <span>Publish</span>
                </button>
                <button
                  mat-menu-item
                  *ngIf="project.status !== 'archived'"
                  (click)="store.archiveProject(project.id)"
                >
                  <mat-icon>archive</mat-icon>
                  <span>Archive</span>
                </button>
                <mat-divider></mat-divider>
                <button
                  mat-menu-item
                  color="warn"
                  (click)="deleteProject(project.id)"
                >
                  <mat-icon>delete</mat-icon>
                  <span>Delete</span>
                </button>
              </mat-menu>
            </div>
          </mat-card-header>

          <mat-card-content class="pt-0">
            <div class="flex items-center justify-between mt-4">
              <div class="flex gap-2">
                <mat-chip [class]="getStatusClass(project.status)">
                  {{ project.status | titlecase }}
                </mat-chip>
              </div>
              <div class="text-xs text-gray-500">
                {{ project.createdAt | date: 'short' }}
              </div>
            </div>
          </mat-card-content>
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
export class ProjectsComponent {
  readonly store = inject(ProjectsStore);

  searchQuery = signal('');
  selectedStatus = signal<ProjectStatus | 'all'>('all');
  selectedSort = signal<'recent' | 'name' | 'status'>('recent');

  deleteProject(id: string): void {
    if (confirm('Are you sure you want to delete this project?')) {
      this.store.deleteProject(id);
    }
  }

  onPageChange(event: any): void {
    this.store.setCurrentPage(event.pageIndex + 1);
  }

  getStatusClass(status: ProjectStatus): string {
    const classes: Record<ProjectStatus, string> = {
      draft: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    };
    return classes[status];
  }
}
