import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  status: 'Published' | 'Draft' | 'Scheduled';
  views: number;
  createdDate: string;
  updatedDate: string;
  image?: string;
}

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    DropdownModule,
    PaginatorModule,
    ToastModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">Blog Component Placeholder</h1>
          <p class="text-slate-400 mt-1">Create, edit, and manage your blog posts.</p>
        </div>
        <button
          pButton
          pRipple
          label="Create New Blog"
          icon="pi pi-plus"
          class="p-button-primary"
          (click)="createBlog()">
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <!-- Total Blogs -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Total Blogs</span>
              <span class="text-3xl font-bold text-white block mt-2">24</span>
              <span class="text-xs text-emerald-400 font-semibold mt-1">↑ 8 this month</span>
            </div>
            <div class="text-3xl">📝</div>
          </div>
        </div>

        <!-- Published -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Published</span>
              <span class="text-3xl font-bold text-white block mt-2">18</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">75% of total</span>
            </div>
            <div class="text-3xl">✅</div>
          </div>
        </div>

        <!-- Drafts -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Drafts</span>
              <span class="text-3xl font-bold text-white block mt-2">4</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">16.7% of total</span>
            </div>
            <div class="text-3xl">📋</div>
          </div>
        </div>

        <!-- Total Views -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Total Views</span>
              <span class="text-3xl font-bold text-white block mt-2">12.6K</span>
              <span class="text-xs text-emerald-400 font-semibold mt-1">↑ 24% this month</span>
            </div>
            <div class="text-3xl">👁️</div>
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Search blogs...</label>
            <input
              pInputText
              type="text"
              placeholder="Search by title or slug..."
              class="w-full"
              [(ngModel)]="searchTerm"
              (ngModelChange)="filterBlogs()"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Category</label>
            <p-dropdown
              [options]="categoryOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedCategory"
              (ngModelChange)="filterBlogs()"
              placeholder="All Categories"
              [showClear]="true">
            </p-dropdown>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Status</label>
            <p-dropdown
              [options]="statusOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedStatus"
              (ngModelChange)="filterBlogs()"
              placeholder="All Status"
              [showClear]="true">
            </p-dropdown>
          </div>

          <div class="flex items-end">
            <button
              pButton
              pRipple
              label="Clear Filters"
              icon="pi pi-filter-slash"
              class="p-button-text w-full"
              (click)="clearFilters()">
            </button>
          </div>
        </div>
      </div>

      <!-- Blog Posts Table -->
      <div class="bg-[#07051a] border border-white/10 rounded-2xl overflow-hidden">
        <p-table
          [value]="filteredBlogs"
          [paginator]="true"
          [rows]="10"
          [pageLinks]="5"
          [rowsPerPageOptions]="[10, 20, 50]"
          responsiveLayout="scroll"
          class="p-datatable-dark">

          <ng-template pTemplate="header">
            <tr class="bg-white/5 border-b border-white/10">
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Title</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Category</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Author</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Status</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Views</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Updated</th>
              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase">Actions</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-post>
            <tr class="border-b border-white/5 hover:bg-white/5 transition">
              <td class="px-6 py-4">
                <div>
                  <p class="text-sm font-semibold text-white">{{ post.title }}</p>
                  <p class="text-xs text-slate-400">{{ post.slug }}</p>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="px-2 py-1 rounded text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  {{ post.category }}
                </span>
              </td>
              <td class="px-6 py-4">
                <p class="text-sm text-slate-300">{{ post.author }}</p>
              </td>
              <td class="px-6 py-4">
                <span class="px-3 py-1 rounded-full text-xs font-semibold" [ngClass]="{
                  'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400': post.status === 'Published',
                  'bg-amber-500/10 border border-amber-500/30 text-amber-400': post.status === 'Draft',
                  'bg-blue-500/10 border border-blue-500/30 text-blue-400': post.status === 'Scheduled'
                }">
                  {{ post.status }}
                </span>
              </td>
              <td class="px-6 py-4">
                <p class="text-sm text-slate-300">{{ post.views | number }}</p>
              </td>
              <td class="px-6 py-4">
                <p class="text-sm text-slate-400">{{ post.updatedDate }}</p>
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                  <button
                    pButton
                    pRipple
                    icon="pi pi-eye"
                    class="p-button-rounded p-button-text p-button-sm"
                    title="View"
                    (click)="viewBlog(post)">
                  </button>
                  <button
                    pButton
                    pRipple
                    icon="pi pi-pencil"
                    class="p-button-rounded p-button-text p-button-sm"
                    title="Edit"
                    (click)="editBlog(post)">
                  </button>
                  <button
                    pButton
                    pRipple
                    icon="pi pi-trash"
                    class="p-button-rounded p-button-danger p-button-text p-button-sm"
                    title="Delete"
                    (click)="deleteBlog(post)">
                  </button>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
  styles: [],
})
export class BlogComponent implements OnInit {
  private messageService = inject(MessageService);

  searchTerm = '';
  selectedCategory: string | null = null;
  selectedStatus: string | null = null;

  categoryOptions = [
    { label: 'Web Development', value: 'Web Development' },
    { label: 'Tutorial', value: 'Tutorial' },
    { label: 'AI / Machine Learning', value: 'AI / Machine Learning' },
    { label: 'Backend', value: 'Backend' },
    { label: 'Performance', value: 'Performance' },
  ];

  statusOptions = [
    { label: 'Published', value: 'Published' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Scheduled', value: 'Scheduled' },
  ];

  blogs: BlogPost[] = [
    { id: '1', title: 'Angular 22 Signals: The Future of Reactive Development', slug: 'angular-22-signals', category: 'Web Development', author: 'Rabin R', status: 'Published', views: 1240, createdDate: 'May 24, 2025', updatedDate: 'May 24, 2025' },
    { id: '2', title: 'Building a Portfolio with Angular & Tailwind CSS', slug: 'portfolio-angular-tailwind', category: 'Tutorial', author: 'Rabin R', status: 'Published', views: 980, createdDate: 'May 22, 2025', updatedDate: 'May 22, 2025' },
    { id: '3', title: 'Integrating AI in Web Applications', slug: 'ai-web-apps', category: 'AI / Machine Learning', author: 'Rabin R', status: 'Draft', views: 0, createdDate: 'May 20, 2025', updatedDate: 'May 20, 2025' },
    { id: '4', title: 'Why I Chose Supabase for My Projects', slug: 'supabase-choice', category: 'Backend', author: 'Rabin R', status: 'Published', views: 2400, createdDate: 'May 18, 2025', updatedDate: 'May 18, 2025' },
    { id: '5', title: 'TypeScript Tips Every Developer Should Know', slug: 'typescript-tips', category: 'Tutorial', author: 'Rabin R', status: 'Scheduled', views: 0, createdDate: 'May 28, 2025', updatedDate: 'May 28, 2025' },
    { id: '6', title: 'Web Performance Optimization Guide', slug: 'performance-guide', category: 'Performance', author: 'Rabin R', status: 'Published', views: 3140, createdDate: 'May 15, 2025', updatedDate: 'May 15, 2025' },
  ];

  filteredBlogs: BlogPost[] = [];

  ngOnInit() {
    this.filterBlogs();
  }

  filterBlogs() {
    this.filteredBlogs = this.blogs.filter(post => {
      const matchesSearch = !this.searchTerm ||
        post.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        post.slug.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesCategory = !this.selectedCategory || post.category === this.selectedCategory;
      const matchesStatus = !this.selectedStatus || post.status === this.selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = null;
    this.selectedStatus = null;
    this.filterBlogs();
  }

  createBlog() {
    this.messageService.add({
      severity: 'info',
      summary: 'Create Blog',
      detail: 'Opening blog creation form...',
    });
  }

  viewBlog(post: BlogPost) {
    this.messageService.add({
      severity: 'info',
      summary: 'View Blog',
      detail: `Viewing "${post.title}"`,
    });
  }

  editBlog(post: BlogPost) {
    this.messageService.add({
      severity: 'info',
      summary: 'Edit Blog',
      detail: `Editing "${post.title}"`,
    });
  }

  deleteBlog(post: BlogPost) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Delete Blog',
      detail: `Deleting "${post.title}"...`,
    });
  }
}
