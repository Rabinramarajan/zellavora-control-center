import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { AppDialogService } from './dialog';

@Component({
  selector: 'app-drag-drop-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [],
  templateUrl: './drag-drop-upload.component.html',
  styleUrl: './drag-drop-upload.component.scss',
})
export class DragDropUploadComponent {
  accept = input<string>('image/png, image/jpeg, image/svg+xml');
  maxSizeMb = input<number>(2);
  private readonly dialog = inject(AppDialogService);
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
      this.dialog.alert({
        title: 'File too large',
        message: `File size exceeds limit of ${this.maxSizeMb()}MB.`,
        variant: 'warning',
      });
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
