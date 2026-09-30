import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DOCUMENT_UPLOAD_ACCEPT, DOCUMENT_UPLOAD_LABEL } from './document-upload.models';

@Component({
  selector: 'zcc-document-dropzone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="dropzone"
      [class.over]="dragDepth() > 0"
      [attr.aria-disabled]="disabled()"
      (dragover)="$event.preventDefault()"
      (dragenter)="enter($event)"
      (dragleave)="leave($event)"
      (drop)="drop($event)"
    >
      <span class="cloud"><i class="pi pi-cloud-upload" aria-hidden="true"></i></span>
      <strong>Drag &amp; Drop your documents here</strong>
      <div class="browse">
        <span>or</span>
        <button type="button" [disabled]="disabled()" (click)="picker.click()">
          <i class="pi pi-folder" aria-hidden="true"></i> Browse Files
        </button>
      </div>
      <input
        #picker
        type="file"
        hidden
        multiple
        [accept]="accept()"
        [disabled]="disabled()"
        (change)="select($event)"
      />
      <small
        >Supports {{ label() }} <span aria-hidden="true"> | </span> Max file size:
        {{ maxSizeMb() }} MB per file</small
      >
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 16px;
      justify-content: center;
      border: 1px dashed #70a5ff;
      border-radius: 10px;
      background: #f4f8ff;
      text-align: center;
      color: #596a9f;
    }
    .over {
      background: #e4eeff;
      border-color: #0878ff;
    }
    .cloud {
      display: grid;
      place-items: center;
      background: #e0edff;
      color: #0878ff;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 18px;
    }
    strong {
      font-size: 15px;
      color: #090b59;
    }
    .browse {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    button {
      display: flex;
      align-items: center;
      gap: 10px;
      background: white;
      border: 1px solid #0878ff;
      border-radius: 9px;
      padding: 6px 16px;
      min-height: 36px;
      color: #0878ff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    small {
      font-size: 12px;
      margin-top: 0;
    }
    button:hover:not(:disabled) {
      background: #eaf3ff;
    }
    button:focus-visible {
      outline: 3px solid #91bfff;
      outline-offset: 3px;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
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
