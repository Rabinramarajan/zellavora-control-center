import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
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
    SelectModule,
    ToastModule,
    FileUploadModule,
  ],
  templateUrl: './media.component.html',
  styleUrl: './media.component.css',
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
