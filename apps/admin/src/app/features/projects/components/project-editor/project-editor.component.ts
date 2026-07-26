import { Component, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-project-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-6 space-y-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white">
            {{ isNew ? 'New Project' : 'Edit Project' }}
          </h2>
          <p class="text-slate-600 dark:text-slate-400 mt-1">
            {{ isNew ? 'Create a new project' : 'Update project details' }}
          </p>
        </div>
        <a
          routerLink="/projects"
          class="px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          ← Back
        </a>
      </div>

      <!-- Error State -->
      <div
        *ngIf="projects.error()"
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg text-red-700 dark:text-red-300"
      >
        {{ projects.error() }}
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-8">
        <!-- Basic Info Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4 border border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Basic Information</h3>

          <div class="grid md:grid-cols-2 gap-4">
            <!-- Title -->
            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Project Title *
              </label>
              <input
                type="text"
                formControlName="title"
                placeholder="e.g., E-commerce Platform"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <!-- Slug -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Slug *
              </label>
              <input
                type="text"
                formControlName="slug"
                placeholder="e-commerce-platform"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p class="text-xs text-slate-500 mt-1">Used in URL: /projects/slug</p>
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
                <option value="Web Development">Web Development</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="Full Stack">Full Stack</option>
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="DevOps">DevOps</option>
              </select>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Short Description *
            </label>
            <textarea
              formControlName="description"
              placeholder="Brief overview of the project"
              rows="3"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            ></textarea>
          </div>

          <!-- Content -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Full Project Description
            </label>
            <textarea
              formControlName="content"
              placeholder="Detailed project description, features, challenges, solutions..."
              rows="6"
              class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            ></textarea>
          </div>
        </div>

        <!-- Links Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4 border border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Links & Media</h3>

          <div class="grid md:grid-cols-2 gap-4">
            <!-- GitHub URL -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                GitHub Repository
              </label>
              <input
                type="url"
                formControlName="githubUrl"
                placeholder="https://github.com/username/project"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <!-- Live Demo URL -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Live Demo
              </label>
              <input
                type="url"
                formControlName="liveDemoUrl"
                placeholder="https://project-demo.com"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <!-- Website URL -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Project Website
              </label>
              <input
                type="url"
                formControlName="websiteUrl"
                placeholder="https://project.com"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <!-- Cover Image -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Cover Image URL
              </label>
              <input
                type="url"
                formControlName="coverImageUrl"
                placeholder="https://example.com/cover.jpg"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        <!-- Status Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4 border border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Status & Publishing</h3>

          <div class="space-y-3">
            <!-- Status -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                formControlName="status"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              <p class="text-xs text-slate-500 mt-1">
                Drafts are hidden from public. Published projects appear on your portfolio.
              </p>
            </div>

            <!-- Featured Checkbox -->
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                formControlName="isFeatured"
                class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
              />
              <span class="text-sm text-slate-700 dark:text-slate-300">⭐ Featured Project (show on homepage)</span>
            </label>
          </div>
        </div>

        <!-- SEO Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4 border border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">SEO Metadata</h3>

          <div class="space-y-4">
            <!-- Meta Description -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Meta Description
              </label>
              <textarea
                formControlName="metaDescription"
                placeholder="Brief description for search engines (160 chars max)"
                rows="2"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              ></textarea>
              <p class="text-xs text-slate-500 mt-1">
                {{ form.get('metaDescription')?.value?.length || 0 }}/160 characters
              </p>
            </div>

            <!-- Meta Keywords -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Meta Keywords
              </label>
              <input
                type="text"
                formControlName="metaKeywords"
                placeholder="keyword1, keyword2, keyword3"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <!-- OG Image -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                OG Image URL (for social media)
              </label>
              <input
                type="url"
                formControlName="ogImageUrl"
                placeholder="https://example.com/og-image.jpg"
                class="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        <!-- Submit Buttons -->
        <div class="flex gap-3 sticky bottom-6">
          <button
            type="submit"
            [disabled]="!form.valid || projects.isLoading()"
            class="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span *ngIf="!projects.isLoading()">💾 {{ isNew ? 'Create Project' : 'Save Changes' }}</span>
            <span *ngIf="projects.isLoading()" class="flex items-center gap-2">
              <span class="animate-spin">⏳</span>
              Saving...
            </span>
          </button>
          <a
            routerLink="/projects"
            class="px-8 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </a>
        </div>

        <!-- Success Message -->
        <div
          *ngIf="savedSuccessfully"
          class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg text-green-700 dark:text-green-300"
        >
          ✅ Project {{ isNew ? 'created' : 'saved' }} successfully!
        </div>
      </form>
    </div>
  `,
  styles: [],
})
export class ProjectEditorComponent implements OnInit {
  projects = inject(ProjectsService);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);

  form: FormGroup;
  isNew = true;
  savedSuccessfully = false;
  projectId: string | null = null;

  constructor() {
    this.form = this.fb.group({
      title: ['', Validators.required],
      slug: ['', Validators.required],
      description: ['', Validators.required],
      content: [''],
      status: ['draft'],
      category: [''],
      githubUrl: [''],
      liveDemoUrl: [''],
      websiteUrl: [''],
      coverImageUrl: [''],
      thumbnailUrl: [''],
      metaDescription: [''],
      metaKeywords: [''],
      ogImageUrl: [''],
      isFeatured: [false],
    });
  }

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id');

    if (this.projectId) {
      this.isNew = false;
      this.projects.getProject(this.projectId).subscribe({
        next: (project) => {
          this.form.patchValue(project);
        },
      });
    }
  }

  onSubmit(): void {
    if (!this.form.valid) return;

    if (this.isNew) {
      this.projects.createProject(this.form.value).subscribe({
        next: () => {
          this.showSuccess();
        },
      });
    } else if (this.projectId) {
      this.projects.updateProject(this.projectId, this.form.value).subscribe({
        next: () => {
          this.showSuccess();
        },
      });
    }
  }

  private showSuccess(): void {
    this.savedSuccessfully = true;
    setTimeout(() => {
      this.savedSuccessfully = false;
    }, 3000);
  }
}
