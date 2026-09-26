import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { ConfirmDialogComponent } from '@shared/components/iam';
import { MediaService } from './services/media.service';
import { MediaItem, MediaKind } from './models/media.model';

const PAGE_SIZE = 100;

const KIND_ICONS: Record<MediaKind, string> = {
  image: 'pi pi-image',
  video: 'pi pi-video',
  audio: 'pi pi-volume-up',
  document: 'pi pi-file',
  other: 'pi pi-box',
};

/** Only content served from Vercel Blob (or our own object URLs) may be framed. */
const TRUSTED_FRAME_HOST = /\.blob\.vercel-storage\.com$/;

@Component({
  selector: 'app-media',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    FormInputControl,
    SelectControl,
    ConfirmDialogComponent,
  ],
  templateUrl: './media.component.html',
  styleUrl: './media.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class MediaComponent {
  private readonly mediaService = inject(MediaService);
  private readonly messageService = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<MediaItem[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasMore = signal(false);
  private cursor: string | null = null;

  readonly searchTerm = signal('');
  readonly selectedType = signal('');
  readonly selectedFolder = signal('');
  readonly viewMode = signal<'grid' | 'list'>('grid');

  readonly previewIndex = signal<number | null>(null);
  readonly privateObjectUrl = signal<string | null>(null);
  readonly previewLoading = signal(false);

  readonly pendingDelete = signal<MediaItem | null>(null);
  readonly deleting = signal(false);

  readonly typeOptions: SelectControlOption[] = [
    { label: 'All Types', value: '' },
    { label: 'Images', value: 'image' },
    { label: 'Videos', value: 'video' },
    { label: 'Documents', value: 'document' },
    { label: 'Audio', value: 'audio' },
    { label: 'Other', value: 'other' },
  ];

  readonly folderOptions = computed<SelectControlOption[]>(() => {
    const folders = [...new Set(this.items().map((item) => item.folder))].sort();
    return [
      { label: 'All Folders', value: '' },
      ...folders.map((folder) => ({ label: folder || '(root)', value: folder || '/' })),
    ];
  });

  readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.selectedType();
    const folder = this.selectedFolder();
    return this.items().filter(
      (item) =>
        (!term || item.pathname.toLowerCase().includes(term)) &&
        (!type || item.type === type) &&
        (!folder || (folder === '/' ? item.folder === '' : item.folder === folder))
    );
  });

  readonly hasActiveFilters = computed(
    () => !!(this.searchTerm() || this.selectedType() || this.selectedFolder())
  );

  readonly stats = computed(() => {
    const items = this.items();
    const count = (kind: MediaKind) => items.filter((item) => item.type === kind).length;
    return {
      total: items.length,
      images: count('image'),
      videos: count('video'),
      documents: count('document'),
      audio: count('audio'),
      totalBytes: items.reduce((sum, item) => sum + item.size, 0),
    };
  });

  readonly previewItem = computed(() => {
    const index = this.previewIndex();
    return index === null ? null : (this.filteredItems()[index] ?? null);
  });

  /** Browser-loadable source for the previewed file: direct for public blobs, object URL for private. */
  readonly previewSrc = computed(() => {
    const item = this.previewItem();
    if (!item) return null;
    return item.access === 'public' ? item.url : this.privateObjectUrl();
  });

  readonly previewFrameSrc = computed<SafeResourceUrl | null>(() => {
    const src = this.previewSrc();
    return src && isFrameable(src) ? this.sanitizer.bypassSecurityTrustResourceUrl(src) : null;
  });

  readonly previewCanFrame = computed(() => {
    const item = this.previewItem();
    return !!item && (item.mimeType === 'application/pdf' || item.mimeType.startsWith('text/'));
  });

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => this.revokePrivateObjectUrl());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cursor = null;
    this.mediaService
      .list({ limit: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.set(page.items);
          this.cursor = page.cursor;
          this.hasMore.set(page.hasMore);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(errorMessage(err, 'Could not load media from storage.'));
          this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    if (!this.cursor || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.mediaService
      .list({ limit: PAGE_SIZE, cursor: this.cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.items.update((items) => [...items, ...page.items]);
          this.cursor = page.cursor;
          this.hasMore.set(page.hasMore);
          this.loadingMore.set(false);
        },
        error: (err: unknown) => {
          this.toastError(errorMessage(err, 'Could not load more media.'));
          this.loadingMore.set(false);
        },
      });
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedType.set('');
    this.selectedFolder.set('');
  }

  openPreview(item: MediaItem): void {
    const index = this.filteredItems().indexOf(item);
    if (index === -1) return;
    this.showPreviewAt(index);
  }

  closePreview(): void {
    this.previewIndex.set(null);
    this.revokePrivateObjectUrl();
  }

  showPrevious(): void {
    const index = this.previewIndex();
    const total = this.filteredItems().length;
    if (index === null || total === 0) return;
    this.showPreviewAt((index - 1 + total) % total);
  }

  showNext(): void {
    const index = this.previewIndex();
    const total = this.filteredItems().length;
    if (index === null || total === 0) return;
    this.showPreviewAt((index + 1) % total);
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.previewIndex() === null) return;
    if (event.key === 'ArrowLeft') this.showPrevious();
    if (event.key === 'ArrowRight') this.showNext();
  }

  download(item: MediaItem): void {
    if (item.access === 'public') {
      triggerDownload(item.downloadUrl, item.name);
      return;
    }
    this.mediaService
      .fetchPrivateContent(item)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          triggerDownload(objectUrl, item.name);
          setTimeout(() => URL.revokeObjectURL(objectUrl));
        },
        error: (err: unknown) => this.toastError(errorMessage(err, 'Download failed.')),
      });
  }

  async copyUrl(item: MediaItem): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.url);
      this.messageService.add({ severity: 'success', summary: 'Copied', detail: 'File URL copied.' });
    } catch {
      this.toastError('Clipboard is not available in this browser.');
    }
  }

  requestDelete(item: MediaItem): void {
    this.pendingDelete.set(item);
  }

  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item || this.deleting()) return;
    this.deleting.set(true);
    this.mediaService
      .delete(item)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.previewItem() === item) this.closePreview();
          this.items.update((items) => items.filter((i) => i.pathname !== item.pathname));
          this.pendingDelete.set(null);
          this.deleting.set(false);
          this.messageService.add({
            severity: 'success',
            summary: 'Deleted',
            detail: `${item.name} was deleted.`,
          });
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.toastError(errorMessage(err, `Could not delete ${item.name}.`));
        },
      });
  }

  kindIcon(kind: MediaKind): string {
    return KIND_ICONS[kind];
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${Math.round((bytes / Math.pow(1024, i)) * 10) / 10} ${units[i]}`;
  }

  private showPreviewAt(index: number): void {
    this.revokePrivateObjectUrl();
    this.previewIndex.set(index);
    const item = this.filteredItems()[index];
    if (item?.access !== 'private') return;

    this.previewLoading.set(true);
    this.mediaService
      .fetchPrivateContent(item)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          // Ignore responses for a file the user has already navigated away from.
          if (this.previewItem() !== item) return;
          this.privateObjectUrl.set(URL.createObjectURL(blob));
          this.previewLoading.set(false);
        },
        error: (err: unknown) => {
          this.previewLoading.set(false);
          this.toastError(errorMessage(err, 'Could not load preview.'));
        },
      });
  }

  private revokePrivateObjectUrl(): void {
    const url = this.privateObjectUrl();
    if (url) URL.revokeObjectURL(url);
    this.privateObjectUrl.set(null);
    this.previewLoading.set(false);
  }

  private toastError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Media', detail });
  }
}

function isFrameable(src: string): boolean {
  if (src.startsWith('blob:')) return true;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && TRUSTED_FRAME_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

function triggerDownload(href: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.click();
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const apiMessage = err.error?.error?.message ?? err.error?.message;
    if (typeof apiMessage === 'string' && apiMessage) return apiMessage;
  }
  return fallback;
}
