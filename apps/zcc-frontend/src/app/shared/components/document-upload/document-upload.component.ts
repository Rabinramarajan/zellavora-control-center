import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DocumentDropzoneComponent } from './document-dropzone.component';
import { injectDialogData, injectDialogRef } from '../dialog/dialog.inject';
import { APP_DIALOG_TITLE_ID } from '../dialog/dialog.types';
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_LABEL,
  DOCUMENT_UPLOAD_TYPES,
  DocumentUploadDialogData,
  UploadDocument,
} from './document-upload.models';

@Component({
  selector: 'zcc-document-upload',
  standalone: true,
  imports: [DatePipe, DocumentDropzoneComponent],
  templateUrl: './document-upload.component.html',
  styleUrl: './document-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadComponent {
  private readonly data = injectDialogData<DocumentUploadDialogData>();
  private readonly ref = injectDialogRef<void>();
  // The dialog service points aria-labelledby at this id.
  readonly titleId = inject(APP_DIALOG_TITLE_ID);

  readonly uploadFile = this.data.uploadFile;
  readonly title = this.data.title ?? 'Add Document';
  readonly subtitle = this.data.subtitle ?? 'Upload documents to your library.';
  readonly maxSizeMb = this.data.maxSizeMb ?? 25;
  readonly documents = signal<UploadDocument[]>([]);
  readonly errors = signal<string[]>([]);
  readonly busy = signal(false);
  readonly ready = computed(() =>
    this.documents().filter((d) => d.status === 'ready' || d.status === 'failed')
  );
  readonly accept = DOCUMENT_UPLOAD_ACCEPT;
  readonly acceptLabel = DOCUMENT_UPLOAD_LABEL;

  requestClose(): void {
    if (!this.busy()) this.ref.close();
  }

  addFiles(files: File[]): void {
    if (this.busy()) return;
    const errors: string[] = [];
    const next = [...this.documents()];
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const mimes = DOCUMENT_UPLOAD_TYPES[extension];
      // Browsers report empty or generic types for many formats, so only reject a clear mismatch.
      const typeMismatch =
        !!file.type && file.type !== 'application/octet-stream' && !mimes?.includes(file.type);
      if (!mimes || typeMismatch)
        errors.push(`${file.name}: only ${DOCUMENT_UPLOAD_LABEL} files are supported.`);
      else if (!file.size || file.size > this.maxSizeMb * 1024 * 1024)
        errors.push(
          `${file.name}: file must be non-empty and no larger than ${this.maxSizeMb} MB.`
        );
      else if (
        next.some(
          (d) =>
            d.file.name === file.name &&
            d.file.size === file.size &&
            d.file.lastModified === file.lastModified
        )
      )
        errors.push(`${file.name} is already selected.`);
      else next.push({ id: crypto.randomUUID(), file, status: 'ready' });
    }
    this.documents.set(next);
    this.errors.set(errors);
  }
  remove(id: string): void {
    if (!this.busy()) this.documents.update((rows) => rows.filter((row) => row.id !== id));
  }
  clear(): void {
    if (!this.busy()) {
      this.documents.set([]);
      this.errors.set([]);
    }
  }
  initials(name: string): string {
    const parts = name.split(/[\s@._-]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
  }
  format(file: File): string {
    return file.name.split('.').pop()!.toUpperCase();
  }
  size(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  preview(file: File): void {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
    // Give the new tab time to load before releasing the temporary URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  private update(id: string, patch: Partial<UploadDocument>): void {
    this.documents.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }
  async upload(): Promise<void> {
    if (this.busy() || !this.ready().length) return;
    const pending = this.ready();
    this.busy.set(true);
    // Escape / backdrop must not discard the queue mid-upload.
    this.ref.disableClose = true;
    try {
      for (const row of pending) {
        this.update(row.id, { status: 'uploading', error: undefined, progress: undefined });
        try {
          const result = await this.uploadFile(row.file, (percent) => {
            if (Number.isFinite(percent))
              this.update(row.id, { progress: Math.min(100, Math.max(0, Math.round(percent))) });
          });
          this.update(row.id, {
            status: 'uploaded',
            ...result,
            uploadedOn: result.uploadedOn ?? new Date().toISOString(),
          });
        } catch (error) {
          this.update(row.id, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Upload failed. Please retry.',
          });
        }
      }
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }
}
