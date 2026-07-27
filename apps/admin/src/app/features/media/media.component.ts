import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FileUploadModule } from 'primeng/fileupload';

interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'audio' | 'other';
  size: number;
  uploadedDate: string;
  uploadedBy: string;
  category: string;
  url?: string;
  thumbnail?: string;
}

@Component({
  selector: 'app-media',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    ToastModule,
    FileUploadModule,
  ],
  template: `
    <p-toast></p-toast>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white">Media Gallery</h1>
          <p class="text-slate-400 mt-1">Manage your portfolio media and digital assets in one place.</p>
        </div>
        <button
          pButton
          pRipple
          label="Upload Media"
          icon="pi pi-upload"
          class="p-button-primary"
          (click)="showUploadModal = true">
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-6">
        <!-- Total Assets -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Total Assets</span>
              <span class="text-3xl font-bold text-white block mt-2">248</span>
              <span class="text-xs text-emerald-400 font-semibold mt-1">↑ 12 this month</span>
            </div>
            <div class="text-3xl">📦</div>
          </div>
        </div>

        <!-- Images -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Images</span>
              <span class="text-3xl font-bold text-white block mt-2">132</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">53.2% of total</span>
            </div>
            <div class="text-3xl">🖼️</div>
          </div>
        </div>

        <!-- Videos -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Videos</span>
              <span class="text-3xl font-bold text-white block mt-2">28</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">11.3% of total</span>
            </div>
            <div class="text-3xl">🎥</div>
          </div>
        </div>

        <!-- Documents -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Documents</span>
              <span class="text-3xl font-bold text-white block mt-2">42</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">16.9% of total</span>
            </div>
            <div class="text-3xl">📄</div>
          </div>
        </div>

        <!-- Storage -->
        <div class="bg-[#07051a] border border-white/10 rounded-2xl p-5">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-slate-400 uppercase">Storage Used</span>
              <span class="text-3xl font-bold text-white block mt-2">24.3GB</span>
              <span class="text-xs text-slate-400 font-semibold mt-1">48% of 50GB</span>
            </div>
            <div class="text-3xl">💾</div>
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="bg-[#07051a] border border-white/10 rounded-2xl p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Search media...</label>
            <input
              pInputText
              type="text"
              placeholder="Search by filename..."
              class="w-full"
              [(ngModel)]="searchTerm"
              (ngModelChange)="filterMedia()"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Type</label>
            <p-dropdown
              [options]="typeOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedType"
              (ngModelChange)="filterMedia()"
              placeholder="All Types"
              [showClear]="true">
            </p-dropdown>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-400 mb-2">Category</label>
            <p-dropdown
              [options]="categoryOptions"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="selectedCategory"
              (ngModelChange)="filterMedia()"
              placeholder="All Categories"
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

      <!-- View Toggle -->
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-400">Showing {{ filteredMedia.length }} of {{ media.length }} files</p>
        <div class="flex gap-2">
          <button
            pButton
            pRipple
            icon="pi pi-bars"
            class="p-button-text p-button-sm"
            [disabled]="viewMode === 'list'"
            (click)="viewMode = 'list'">
          </button>
          <button
            pButton
            pRipple
            icon="pi pi-th-large"
            class="p-button-text p-button-sm"
            [disabled]="viewMode === 'grid'"
            (click)="viewMode = 'grid'">
          </button>
        </div>
      </div>

      <!-- Media Grid View -->
      <div *ngIf="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div *ngFor="let file of filteredMedia" class="group cursor-pointer">
          <div class="bg-[#07051a] border border-white/10 rounded-xl p-3 aspect-square flex items-center justify-center hover:border-purple-500/50 transition overflow-hidden relative">
            <!-- Thumbnail -->
            <img *ngIf="file.type === 'image'" [src]="file.thumbnail || file.url" alt="{{ file.name }}" class="w-full h-full object-cover group-hover:scale-110 transition" />
            <div *ngIf="file.type !== 'image'" class="text-4xl">
              {{ file.type === 'video' ? '🎥' : file.type === 'document' ? '📄' : file.type === 'audio' ? '🎵' : '📦' }}
            </div>

            <!-- Overlay -->
            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              <button
                pButton
                pRipple
                icon="pi pi-eye"
                class="p-button-rounded p-button-secondary p-button-sm"
                title="Preview"
                (click)="previewFile(file)">
              </button>
              <button
                pButton
                pRipple
                icon="pi pi-download"
                class="p-button-rounded p-button-secondary p-button-sm"
                title="Download"
                (click)="downloadFile(file)">
              </button>
              <button
                pButton
                pRipple
                icon="pi pi-trash"
                class="p-button-rounded p-button-danger p-button-sm"
                title="Delete"
                (click)="deleteFile(file)">
              </button>
            </div>
          </div>
          <p class="text-xs text-slate-400 mt-2 truncate">{{ file.name }}</p>
          <p class="text-[10px] text-slate-500">{{ formatFileSize(file.size) }}</p>
        </div>
      </div>

      <!-- Media List View -->
      <div *ngIf="viewMode === 'list'" class="bg-[#07051a] border border-white/10 rounded-2xl overflow-hidden">
        <div class="space-y-2">
          <div *ngFor="let file of filteredMedia" class="flex items-center justify-between p-4 hover:bg-white/5 transition border-b border-white/5 last:border-0">
            <div class="flex items-center gap-3 flex-1">
              <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg">
                {{ file.type === 'image' ? '🖼️' : file.type === 'video' ? '🎥' : file.type === 'document' ? '📄' : file.type === 'audio' ? '🎵' : '📦' }}
              </div>
              <div>
                <p class="text-sm font-semibold text-white">{{ file.name }}</p>
                <p class="text-xs text-slate-400">{{ formatFileSize(file.size) }} • {{ file.uploadedDate }}</p>
              </div>
            </div>
            <span class="px-2 py-1 rounded text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400">
              {{ file.category }}
            </span>
            <div class="flex items-center gap-2 ml-4">
              <button
                pButton
                pRipple
                icon="pi pi-eye"
                class="p-button-rounded p-button-text p-button-sm"
                title="Preview"
                (click)="previewFile(file)">
              </button>
              <button
                pButton
                pRipple
                icon="pi pi-download"
                class="p-button-rounded p-button-text p-button-sm"
                title="Download"
                (click)="downloadFile(file)">
              </button>
              <button
                pButton
                pRipple
                icon="pi pi-trash"
                class="p-button-rounded p-button-danger p-button-text p-button-sm"
                title="Delete"
                (click)="deleteFile(file)">
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [],
})
export class MediaComponent implements OnInit {
  private messageService = inject(MessageService);

  showUploadModal = false;
  searchTerm = '';
  selectedType: string | null = null;
  selectedCategory: string | null = null;
  viewMode: 'grid' | 'list' = 'grid';

  typeOptions = [
    { label: 'Images', value: 'image' },
    { label: 'Videos', value: 'video' },
    { label: 'Documents', value: 'document' },
    { label: 'Audio', value: 'audio' },
  ];

  categoryOptions = [
    { label: 'Project Images', value: 'Project Images' },
    { label: 'Portfolio', value: 'Portfolio' },
    { label: 'Blog', value: 'Blog' },
    { label: 'General', value: 'General' },
  ];

  media: MediaFile[] = [
    { id: '1', name: 'mountains-lake.jpg', type: 'image', size: 2400000, uploadedDate: 'May 24, 2025', uploadedBy: 'Rabin R', category: 'Portfolio', thumbnail: '🖼️' },
    { id: '2', name: 'zellavora-logo.png', type: 'image', size: 150000, uploadedDate: 'May 21, 2025', uploadedBy: 'Rabin R', category: 'General' },
    { id: '3', name: 'workspace-setup.webp', type: 'image', size: 1800000, uploadedDate: 'May 20, 2025', uploadedBy: 'Rabin R', category: 'Project Images' },
    { id: '4', name: 'Project-Overview.pdf', type: 'document', size: 1500000, uploadedDate: 'May 19, 2025', uploadedBy: 'Rabin R', category: 'General' },
    { id: '5', name: 'city-timelapse.mp4', type: 'video', size: 124000000, uploadedDate: 'May 18, 2025', uploadedBy: 'Rabin R', category: 'General' },
    { id: '6', name: 'dashboard-preview.png', type: 'image', size: 1800000, uploadedDate: 'May 17, 2025', uploadedBy: 'Rabin R', category: 'Project Images' },
    { id: '7', name: 'podcast-episode.mp3', type: 'audio', size: 48000000, uploadedDate: 'May 17, 2025', uploadedBy: 'Rabin R', category: 'General' },
    { id: '8', name: 'code-snippet.jpg', type: 'image', size: 1300000, uploadedDate: 'May 14, 2025', uploadedBy: 'Rabin R', category: 'Blog' },
    { id: '9', name: 'purple-abstract.jpg', type: 'image', size: 1700000, uploadedDate: 'May 13, 2025', uploadedBy: 'Rabin R', category: 'Portfolio' },
    { id: '10', name: 'brand-guidelines.pdf', type: 'document', size: 3200000, uploadedDate: 'May 13, 2025', uploadedBy: 'Rabin R', category: 'General' },
    { id: '11', name: 'mobile-mockup.png', type: 'image', size: 2100000, uploadedDate: 'May 7, 2025', uploadedBy: 'Rabin R', category: 'Project Images' },
    { id: '12', name: 'icons-pack.svg', type: 'image', size: 890000, uploadedDate: 'May 16, 2025', uploadedBy: 'Rabin R', category: 'General' },
  ];

  filteredMedia: MediaFile[] = [];

  ngOnInit() {
    this.filterMedia();
  }

  filterMedia() {
    this.filteredMedia = this.media.filter(file => {
      const matchesSearch = !this.searchTerm ||
        file.name.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesType = !this.selectedType || file.type === this.selectedType;
      const matchesCategory = !this.selectedCategory || file.category === this.selectedCategory;

      return matchesSearch && matchesType && matchesCategory;
    });
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedType = null;
    this.selectedCategory = null;
    this.filterMedia();
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  previewFile(file: MediaFile) {
    this.messageService.add({
      severity: 'info',
      summary: 'Preview',
      detail: `Previewing ${file.name}`,
    });
  }

  downloadFile(file: MediaFile) {
    this.messageService.add({
      severity: 'success',
      summary: 'Download',
      detail: `Downloading ${file.name}...`,
    });
  }

  deleteFile(file: MediaFile) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Delete',
      detail: `Deleting ${file.name}...`,
    });
  }
}
