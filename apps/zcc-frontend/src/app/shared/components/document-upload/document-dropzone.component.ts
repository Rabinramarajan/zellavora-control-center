import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_LABEL } from './document-upload.models';

@Component({
  selector: 'zcc-document-dropzone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './document-dropzone.component.html',
  styleUrl: './document-dropzone.component.scss',
})
export class DocumentDropzoneComponent {
  readonly accept = input(DOCUMENT_UPLOAD_ACCEPT);
  readonly label = input(DOCUMENT_UPLOAD_LABEL);
  readonly maxSizeMb = input(25);
  readonly disabled = input(false);
  readonly filesSelected = output<File[]>();
  readonly dragDepth = signal(0);
  enter(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) this.dragDepth.update((n) => n + 1);
  }
  leave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth.update((n) => Math.max(0, n - 1));
  }
  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth.set(0);
    if (!this.disabled()) this.filesSelected.emit(Array.from(event.dataTransfer?.files ?? []));
  }
  select(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (!this.disabled()) this.filesSelected.emit(Array.from(element.files ?? []));
    element.value = '';
  }
}
