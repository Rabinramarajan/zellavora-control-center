import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PortfolioService } from '../../services/portfolio.service';
import { Skill } from '@shared/models';

@Component({
  selector: 'app-skills-manager',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">Skills Management</h2>
        <p class="text-slate-600 dark:text-slate-400">Add and manage your professional skills</p>
      </div>

      <!-- Add Skill Form -->
      <div class="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-6 border border-slate-200 dark:border-slate-600">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add New Skill</h3>

        <form [formGroup]="form" (ngSubmit)="addSkill()" class="space-y-4">
          <div class="grid md:grid-cols-2 gap-4">
            <!-- Skill Name -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Skill Name *
              </label>
              <input
                type="text"
                formControlName="name"
                placeholder="e.g., TypeScript, React, Node.js"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <!-- Category -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Category
              </label>
              <select
                formControlName="category"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select category...</option>
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="Database">Database</option>
                <option value="DevOps">DevOps</option>
                <option value="Tools">Tools</option>
                <option value="Soft Skills">Soft Skills</option>
              </select>
            </div>

            <!-- Proficiency -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Proficiency Level
              </label>
              <select
                formControlName="proficiencyLevel"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Select level...</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>

            <!-- Years of Experience -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Years of Experience
              </label>
              <input
                type="number"
                formControlName="yearsOfExperience"
                placeholder="e.g., 5"
                min="0"
                step="0.5"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <!-- Featured Checkbox -->
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              formControlName="isFeatured"
              class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
            />
            <span class="text-sm text-slate-700 dark:text-slate-300">Mark as featured skill</span>
          </label>

          <!-- Submit -->
          <div class="flex gap-3">
            <button
              type="submit"
              [disabled]="!form.valid || portfolio.isLoading()"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              <span *ngIf="!portfolio.isLoading()">➕ Add Skill</span>
              <span *ngIf="portfolio.isLoading()">⏳ Adding...</span>
            </button>
            <button
              type="button"
              (click)="resetForm()"
              class="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <!-- Skills List -->
      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
          Your Skills ({{ portfolio.skills().length }})
        </h3>

        <div *ngIf="portfolio.skills().length === 0" class="text-center py-8">
          <p class="text-slate-600 dark:text-slate-400">No skills added yet</p>
        </div>

        <div
          *ngFor="let skill of portfolio.skills()"
          class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between hover:shadow-lg transition-shadow"
        >
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <h4 class="font-semibold text-slate-900 dark:text-white">{{ skill.name }}</h4>
              <span *ngIf="skill.isFeatured" class="bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs px-2 py-1 rounded">
                Featured
              </span>
            </div>
            <div class="flex flex-wrap gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span *ngIf="skill.category">📂 {{ skill.category }}</span>
              <span *ngIf="skill.proficiencyLevel">📊 {{ skill.proficiencyLevel }}</span>
              <span *ngIf="skill.yearsOfExperience">⏰ {{ skill.yearsOfExperience }} yrs</span>
            </div>
          </div>

          <button
            (click)="deleteSkill(skill.id)"
            class="ml-4 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class SkillsManagerComponent {
  portfolio = inject(PortfolioService);
  fb = inject(FormBuilder);

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      category: [''],
      proficiencyLevel: [''],
      yearsOfExperience: [null],
      isFeatured: [false],
    });
  }

  addSkill(): void {
    if (!this.form.valid) return;

    this.portfolio.createSkill(this.form.value).subscribe({
      next: () => {
        this.resetForm();
      },
      error: (error) => {
        console.error('Error adding skill:', error);
      },
    });
  }

  deleteSkill(id: string): void {
    if (confirm('Are you sure you want to delete this skill?')) {
      this.portfolio.deleteSkill(id).subscribe();
    }
  }

  resetForm(): void {
    this.form.reset();
  }
}
