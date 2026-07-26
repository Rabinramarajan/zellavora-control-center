import { Component, Input, Output, EventEmitter, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechnologyService } from '../../services/technology.service';

@Component({
  selector: 'app-technology-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-6 border border-slate-200 dark:border-slate-700">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Technologies Used</h3>

      <!-- Search & Filter -->
      <div class="space-y-3">
        <input
          type="text"
          [(ngModel)]="searchQuery"
          placeholder="Search technologies..."
          class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        />

        <!-- Category Filter -->
        <div class="flex gap-2 flex-wrap">
          <button
            (click)="filterCategory = null"
            [class.bg-blue-600]="!filterCategory"
            [class.text-white]="!filterCategory"
            [class.bg-slate-200]="filterCategory"
            [class.text-slate-700]="filterCategory"
            [class.dark:bg-slate-700]="filterCategory"
            [class.dark:text-slate-300]="filterCategory"
            class="px-3 py-1 rounded-full text-sm font-medium transition-colors"
          >
            All
          </button>
          <button
            *ngFor="let category of categories()"
            (click)="filterCategory = category"
            [class.bg-blue-600]="filterCategory === category"
            [class.text-white]="filterCategory === category"
            [class.bg-slate-200]="filterCategory !== category"
            [class.text-slate-700]="filterCategory !== category"
            [class.dark:bg-slate-700]="filterCategory !== category"
            [class.dark:text-slate-300]="filterCategory !== category"
            class="px-3 py-1 rounded-full text-sm font-medium transition-colors"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <!-- Technologies Grid -->
      <div class="space-y-4">
        <!-- Selected Technologies -->
        <div *ngIf="selectedTechnologies().length > 0" class="space-y-2">
          <p class="text-sm font-medium text-slate-600 dark:text-slate-400">
            Selected ({{ selectedTechnologies().length }})
          </p>
          <div class="flex flex-wrap gap-2">
            <div
              *ngFor="let tech of selectedTechnologies()"
              class="flex items-center gap-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-full"
            >
              <span *ngIf="tech.iconUrl" class="w-4 h-4 rounded overflow-hidden">
                <img [src]="tech.iconUrl" [alt]="tech.name" class="w-full h-full object-cover" />
              </span>
              <span class="text-sm font-medium">{{ tech.name }}</span>
              <button
                (click)="removeTechnology(tech.id)"
                class="ml-1 text-lg font-bold hover:scale-125 transition-transform"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- Available Technologies -->
        <div class="space-y-2">
          <p class="text-sm font-medium text-slate-600 dark:text-slate-400">
            Available Technologies
          </p>

          <div class="grid md:grid-cols-2 gap-3">
            <div
              *ngFor="let tech of filteredTechnologies()"
              (click)="toggleTechnology(tech.id)"
              class="p-3 rounded-lg border-2 transition-all cursor-pointer"
              [class.border-blue-500]="isSelected(tech.id)"
              [class.bg-blue-50]="isSelected(tech.id)"
              [class.dark:bg-blue-900/20]="isSelected(tech.id)"
              [class.border-slate-300]="!isSelected(tech.id)"
              [class.dark:border-slate-600]="!isSelected(tech.id)"
              [class.hover:border-blue-400]="!isSelected(tech.id)"
              [class.dark:hover:border-blue-600]="!isSelected(tech.id)"
            >
              <div class="flex items-start gap-3">
                <!-- Icon -->
                <div *ngIf="tech.iconUrl" class="w-8 h-8 flex-shrink-0">
                  <img [src]="tech.iconUrl" [alt]="tech.name" class="w-full h-full object-contain" />
                </div>
                <div *ngIf="!tech.iconUrl" class="w-8 h-8 flex-shrink-0 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center text-sm">
                  🔧
                </div>

                <!-- Info -->
                <div class="flex-1">
                  <p class="font-medium text-slate-900 dark:text-white">{{ tech.name }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400" *ngIf="tech.category">
                    {{ tech.category }}
                  </p>
                  <p class="text-xs text-slate-600 dark:text-slate-300 mt-1" *ngIf="tech.description">
                    {{ tech.description }}
                  </p>
                </div>

                <!-- Checkbox -->
                <div
                  class="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center mt-0.5"
                  [class.bg-blue-600]="isSelected(tech.id)"
                  [class.border-blue-600]="isSelected(tech.id)"
                  [class.border-slate-300]="!isSelected(tech.id)"
                  [class.dark:border-slate-600]="!isSelected(tech.id)"
                >
                  <span *ngIf="isSelected(tech.id)" class="text-white text-sm">✓</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div *ngIf="filteredTechnologies().length === 0" class="text-center py-8">
            <p class="text-slate-600 dark:text-slate-400">No technologies found</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="technology.isLoading()" class="flex items-center gap-2 text-slate-600">
        <div class="animate-spin">⏳</div>
        Loading technologies...
      </div>

      <!-- Error State -->
      <div
        *ngIf="technology.error()"
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300 text-sm"
      >
        {{ technology.error() }}
      </div>
    </div>
  `,
  styles: [],
})
export class TechnologySelectorComponent {
  @Input() projectId: string | null = null;
  @Output() technologiesChanged = new EventEmitter<string[]>();

  technology = inject(TechnologyService);

  searchQuery = '';
  filterCategory: string | null = null;

  constructor() {
    effect(() => {
      if (this.projectId) {
        this.technology.getProjectTechnologies(this.projectId).subscribe();
      }
    });
  }

  categories() {
    const cats = new Set(
      this.technology
        .allTechnologies()
        .map((t) => t.category)
        .filter((c) => c)
    );
    return Array.from(cats).sort();
  }

  filteredTechnologies() {
    return this.technology.allTechnologies().filter((tech) => {
      const matchesSearch =
        !this.searchQuery ||
        tech.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        tech.description?.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesCategory =
        !this.filterCategory || tech.category === this.filterCategory;

      return matchesSearch && matchesCategory;
    });
  }

  selectedTechnologies() {
    const ids = new Set(
      this.technology.projectTechnologies().map((pt) => pt.technologyId)
    );
    return this.technology
      .allTechnologies()
      .filter((t) => ids.has(t.id))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  isSelected(id: string): boolean {
    return this.technology.selectedTechIds().includes(id);
  }

  toggleTechnology(id: string): void {
    if (!this.projectId) return;

    if (this.isSelected(id)) {
      this.technology
        .removeTechnologyFromProject(this.projectId, id)
        .subscribe(() => {
          this.emitChanges();
        });
    } else {
      this.technology
        .addTechnologyToProject(this.projectId, id)
        .subscribe(() => {
          this.emitChanges();
        });
    }
  }

  removeTechnology(id: string): void {
    if (!this.projectId) return;

    this.technology
      .removeTechnologyFromProject(this.projectId, id)
      .subscribe(() => {
        this.emitChanges();
      });
  }

  private emitChanges(): void {
    this.technologiesChanged.emit(
      this.technology.selectedTechIds()
    );
  }
}
