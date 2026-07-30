import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-drag-drop-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer"
      [class.border-indigo-500]="isDragOver()"
      [class.bg-indigo-500/5]="isDragOver()"
      [class.border-gray-300]="!isDragOver()"
      [class.dark:border-white/10]="!isDragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
      (click)="fileInput.click()"
    >
      <input
        #fileInput
        type="file"
        class="hidden"
        [accept]="accept()"
        (change)="onFileSelected($event)"
      />
      
      @if (previewUrl()) {
        <div class="flex flex-col items-center gap-4">
          <img [src]="previewUrl()" alt="Upload preview" class="h-24 w-24 object-contain rounded-lg border dark:border-white/10 p-1" />
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Click or drag to replace
          </div>
        </div>
      } @else {
        <div class="flex flex-col items-center gap-2">
          <div class="text-3xl text-gray-400 dark:text-gray-500 mb-2">📁</div>
          <span class="font-medium text-gray-700 dark:text-gray-300">Drag & drop your logo here</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">Supports PNG, JPG, or SVG up to 2MB</span>
        </div>
      }
    </div>
  `
})
export class DragDropUploadComponent {
  accept = input<string>('image/png, image/jpeg, image/svg+xml');
  maxSizeMb = input<number>(2);
  upload = output<string>();

  isDragOver = signal(false);
  previewUrl = signal<string | null>(null);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave() {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  private processFile(file: File) {
    if (file.size > this.maxSizeMb() * 1024 * 1024) {
      alert(`File size exceeds limit of ${this.maxSizeMb()}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      this.previewUrl.set(base64String);
      this.upload.emit(base64String);
    };
    reader.readAsDataURL(file);
  }
}
