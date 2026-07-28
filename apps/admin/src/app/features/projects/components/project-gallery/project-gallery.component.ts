import { Component, input, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-project-gallery',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './project-gallery.component.html',
  styleUrl: './project-gallery.component.css',
})
export class ProjectGalleryComponent {
  readonly projectId = input<string | null>(null);

  gallery = inject(GalleryService);
  fb = inject(FormBuilder);

  imageCaption = '';

  constructor() {
    effect(() => {
      const projId = this.projectId();
      if (projId) {
        this.gallery.getGallery(projId).subscribe();
      }
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const projId = this.projectId();

    if (!files || !projId) return;

    Array.from(files).forEach((file) => {
      this.gallery
        .uploadImage(projId, file, this.imageCaption || undefined)
        .subscribe({
          next: () => {
            this.imageCaption = '';
            input.value = ''; // Reset input
          },
          error: (error) => {
            console.error('Upload error:', error);
          },
        });
    });
  }

  moveUp(imageId: string): void {
    const items = this.gallery.items();
    const currentIndex = items.findIndex((i) => i.id === imageId);
    const projId = this.projectId();

    if (currentIndex > 0 && projId) {
      this.gallery
        .reorderImage(projId, imageId, currentIndex - 1)
        .subscribe();
    }
  }

  moveDown(imageId: string): void {
    const items = this.gallery.items();
    const currentIndex = items.findIndex((i) => i.id === imageId);
    const projId = this.projectId();

    if (currentIndex < items.length - 1 && projId) {
      this.gallery
        .reorderImage(projId, imageId, currentIndex + 1)
        .subscribe();
    }
  }

  deleteImage(imageId: string): void {
    const projId = this.projectId();
    if (
      confirm('Are you sure you want to delete this image?') &&
      projId
    ) {
      this.gallery.deleteImage(projId, imageId).subscribe();
    }
  }

  clearCaption(): void {
    this.imageCaption = '';
  }
}
