import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConfirmDialogComponent } from '@shared/components/iam';
import { MediaService } from './services/media.service';
import { MediaItem, MediaKind } from './models/media.model';

const PAGE_SIZE = 100;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const KIND_ICONS: Record<MediaKind, string> = {
  image: 'pi pi-image',
  video: 'pi pi-video',
  audio: 'pi pi-volume-up',
  document: 'pi pi-file',
  other: 'pi pi-box',
};

/** Mirrors the backend cap, so oversized files fail fast without an upload round-trip. */
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export type MediaTab = 'all' | 'image' | 'video' | 'document';
export type MediaSort = 'newest' | 'oldest' | 'name' | 'largest' | 'smallest';

interface Dimensions {
  width: number;
  height: number;
}

@Component({
  selector: 'app-media',
  standalone: true,
  imports: [CommonModule, ButtonModule, ToastModule, ConfirmDialogComponent],
  templateUrl: './media.component.html',
  styleUrl: './media.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
    '(document:click)': 'openMenu.set(null)',
  },
})
export class MediaComponent {
  private readonly mediaService = inject(MediaService);
  private readonly messageService = inject(MessageService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly items = signal<MediaItem[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly uploading = signal(false);
  readonly maxUploadMb = MAX_UPLOAD_BYTES / (1024 * 1024);
  readonly error = signal<string | null>(null);
  readonly hasMore = signal(false);
  private cursor: string | null = null;

  /** Draft filter values; applied on Search / Enter so the grid doesn't reflow per keystroke. */
  readonly searchDraft = signal('');
  readonly typeDraft = signal<MediaTab>('all');
  readonly folderDraft = signal('');
  readonly sortDraft = signal<MediaSort>('newest');

  readonly searchTerm = signal('');
  readonly activeTab = signal<MediaTab>('all');
  readonly selectedFolder = signal('');
  readonly sortBy = signal<MediaSort>('newest');
  readonly viewMode = signal<'grid' | 'list'>('grid');

  readonly page = signal(1);
  readonly pageSize = signal(24);
  readonly pageSizeOptions = [12, 24, 48, 96];

  readonly selectMode = signal(false);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly openMenu = signal<string | null>(null);
  readonly dimensions = signal<Record<string, Dimensions>>({});

  readonly previewIndex = signal<number | null>(null);
  readonly privateObjectUrl = signal<string | null>(null);
  readonly previewLoading = signal(false);

  readonly pendingDelete = signal<MediaItem[] | null>(null);
  readonly deleting = signal(false);

  readonly typeOptions: { label: string; value: MediaTab }[] = [
    { label: 'All Types', value: 'all' },
    { label: 'Images', value: 'image' },
    { label: 'Videos', value: 'video' },
    { label: 'Documents', value: 'document' },
  ];

  readonly sortOptions: { label: string; value: MediaSort }[] = [
    { label: 'Newest', value: 'newest' },
    { label: 'Oldest', value: 'oldest' },
    { label: 'Name (A–Z)', value: 'name' },
    { label: 'Largest', value: 'largest' },
    { label: 'Smallest', value: 'smallest' },
  ];

  readonly folders = computed(() => [...new Set(this.items().map((item) => item.folder))].sort());

  readonly stats = computed(() => {
    const items = this.items();
    const count = (kind: MediaKind): number => items.filter((item) => item.type === kind).length;
    const since = Date.now() - MONTH_MS;
    return {
      total: items.length,
      images: count('image'),
      videos: count('video'),
      documents: count('document'),
      recent: items.filter((item) => new Date(item.uploadedAt).getTime() >= since).length,
      totalBytes: items.reduce((sum, item) => sum + item.size, 0),
    };
  });

  /** Items matching search + folder, before the type tab narrows them — drives tab counts. */
  private readonly baseFiltered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const folder = this.selectedFolder();
    return this.items().filter(
      (item) =>
        (!term || item.pathname.toLowerCase().includes(term)) &&
        (!folder || (folder === '/' ? item.folder === '' : item.folder === folder))
    );
  });

  readonly tabs = computed(() => {
    const base = this.baseFiltered();
    const count = (kind: MediaKind): number => base.filter((item) => item.type === kind).length;
    return [
      { value: 'all' as const, label: 'All Files', icon: 'pi pi-th-large', count: base.length },
      { value: 'image' as const, label: 'Images', icon: 'pi pi-image', count: count('image') },
      { value: 'video' as const, label: 'Videos', icon: 'pi pi-video', count: count('video') },
      {
        value: 'document' as const,
        label: 'Documents',
        icon: 'pi pi-file',
        count: count('document'),
      },
    ];
  });

  readonly filteredItems = computed(() => {
    const tab = this.activeTab();
    const list = this.baseFiltered().filter((item) => tab === 'all' || item.type === tab);
    return list.sort(SORTERS[this.sortBy()]);
  });

  readonly hasActiveFilters = computed(
    () =>
      !!(this.searchTerm() || this.selectedFolder()) ||
      this.activeTab() !== 'all' ||
      this.sortBy() !== 'newest'
  );

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize()))
  );

  readonly pagedItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  readonly rangeLabel = computed(() => {
    const total = this.filteredItems().length;
    if (total === 0) return 'No files';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(start + this.pageSize() - 1, total);
    return `Showing ${start} to ${end} of ${total} files`;
  });

  /** Compact page list with ellipses: 1 … 4 5 6 … 12. */
  readonly pageNumbers = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current - 1, current, current + 1]);
    if (current <= 4) [2, 3, 4, 5].forEach((p) => pages.add(p));
    if (current >= total - 3)
      [total - 4, total - 3, total - 2, total - 1].forEach((p) => pages.add(p));
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? [null, p] : [p]));
  });

  readonly selectedItems = computed(() => {
    const keys = this.selected();
    return this.items().filter((item) => keys.has(item.pathname));
  });

  readonly allPageSelected = computed(() => {
    const page = this.pagedItems();
    const keys = this.selected();
    return page.length > 0 && page.every((item) => keys.has(item.pathname));
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
    // Keep the current page valid when filters or deletions shrink the result set.
    effect(() => {
      const total = this.totalPages();
      if (this.page() > total) this.page.set(total);
    });
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
      this.revokePrivateObjectUrl();
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cursor = null;
    this.selected.set(new Set());
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

  applyFilters(): void {
    this.searchTerm.set(this.searchDraft());
    this.activeTab.set(this.typeDraft());
    this.selectedFolder.set(this.folderDraft());
    this.sortBy.set(this.sortDraft());
    this.page.set(1);
  }

  clearFilters(): void {
    this.searchDraft.set('');
    this.typeDraft.set('all');
    this.folderDraft.set('');
    this.sortDraft.set('newest');
    this.applyFilters();
  }

  selectTab(tab: MediaTab): void {
    this.activeTab.set(tab);
    this.typeDraft.set(tab);
    this.page.set(1);
  }

  goToPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  setPageSize(size: string): void {
    this.pageSize.set(Number(size));
    this.page.set(1);
  }

  toggleSelectMode(): void {
    this.selectMode.update((on) => !on);
    if (!this.selectMode()) this.selected.set(new Set());
  }

  toggleSelected(item: MediaItem): void {
    this.selectMode.set(true);
    this.selected.update((keys) => {
      const next = new Set(keys);
      if (!next.delete(item.pathname)) next.add(item.pathname);
      return next;
    });
  }

  toggleSelectPage(): void {
    const page = this.pagedItems();
    const selectAll = !this.allPageSelected();
    this.selected.update((keys) => {
      const next = new Set(keys);
      page.forEach((item) => (selectAll ? next.add(item.pathname) : next.delete(item.pathname)));
      return next;
    });
  }

  isSelected(item: MediaItem): boolean {
    return this.selected().has(item.pathname);
  }

  onCardClick(item: MediaItem): void {
    if (this.selectMode()) this.toggleSelected(item);
    else this.openPreview(item);
  }

  toggleMenu(item: MediaItem, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((open) => (open === item.pathname ? null : item.pathname));
  }

  recordDimensions(item: MediaItem, event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.naturalWidth || this.dimensions()[item.pathname]) return;
    this.dimensions.update((dims) => ({
      ...dims,
      [item.pathname]: { width: img.naturalWidth, height: img.naturalHeight },
    }));
  }

  dimensionsOf(item: MediaItem): string | null {
    const dims = this.dimensions()[item.pathname];
    return dims ? `${dims.width} × ${dims.height}` : null;
  }

  extension(item: MediaItem): string {
    const dot = item.name.lastIndexOf('.');
    return dot > 0 ? item.name.slice(dot + 1, dot + 5).toUpperCase() : item.type.toUpperCase();
  }

  openPreview(item: MediaItem): void {
    const index = this.filteredItems().indexOf(item);
    if (index === -1) return;
    this.showPreviewAt(index);
  }

  closePreview(): void {
    document.body.style.overflow = '';
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
    if (event.key === 'Escape') this.openMenu.set(null);
    if (this.previewIndex() === null) return;
    if (event.key === 'Escape') this.closePreview();
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
      this.messageService.add({
        severity: 'success',
        summary: 'Copied',
        detail: 'File URL copied.',
      });
    } catch {
      this.toastError('Clipboard is not available in this browser.');
    }
  }

  requestDelete(items: MediaItem[]): void {
    if (items.length) this.pendingDelete.set(items);
  }

  deleteMessage(items: MediaItem[]): string {
    const subject = items.length === 1 ? items[0].name : `${items.length} files`;
    return `${subject} will be permanently removed from the Blob store. Any page linking to ${
      items.length === 1 ? 'it' : 'them'
    } will break.`;
  }

  confirmDelete(): void {
    const targets = this.pendingDelete();
    if (!targets || this.deleting()) return;
    this.deleting.set(true);
    const failed: MediaItem[] = [];
    let remaining = targets.length;

    const settle = (): void => {
      if (--remaining > 0) return;
      const removed = new Set(targets.filter((t) => !failed.includes(t)).map((t) => t.pathname));
      const preview = this.previewItem();
      if (preview && removed.has(preview.pathname)) this.closePreview();
      this.items.update((items) => items.filter((i) => !removed.has(i.pathname)));
      this.selected.update((keys) => new Set([...keys].filter((key) => !removed.has(key))));
      this.pendingDelete.set(null);
      this.deleting.set(false);
      if (removed.size) {
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail:
            removed.size === 1
              ? `${targets[0].name} was deleted.`
              : `${removed.size} files deleted.`,
        });
      }
      if (failed.length) this.toastError(`Could not delete ${failed.length} file(s).`);
    };

    targets.forEach((item) =>
      this.mediaService
        .delete(item)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: settle,
          error: () => {
            failed.push(item);
            settle();
          },
        })
    );
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

  showPreviewAt(index: number): void {
    document.body.style.overflow = 'hidden';
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

  async uploadFiles(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = ''; // allow re-selecting the same file
    if (!files.length) return;

    const oversized = files.filter((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversized.length) {
      this.toastError(
        `${oversized.map((f) => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} the ${this.maxUploadMb} MB limit.`
      );
    }
    const accepted = files.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    if (!accepted.length) return;

    this.uploading.set(true);
    const uploaded: MediaItem[] = [];
    for (const file of accepted) {
      try {
        uploaded.push(await firstValueFrom(this.mediaService.upload(file)));
      } catch (err) {
        this.toastError(errorMessage(err, `Could not upload ${file.name}.`));
      }
    }
    this.uploading.set(false);

    if (uploaded.length) {
      this.items.update((items) => [...uploaded.reverse(), ...items]);
      this.messageService.add({
        severity: 'success',
        summary: 'Uploaded',
        detail: `${uploaded.length} file(s) added to the library.`,
      });
    }
  }

  private toastError(detail: string): void {
    this.messageService.add({ severity: 'error', summary: 'Media', detail });
  }
}

const time = (item: MediaItem): number => new Date(item.uploadedAt).getTime();

const SORTERS: Record<MediaSort, (a: MediaItem, b: MediaItem) => number> = {
  newest: (a, b) => time(b) - time(a),
  oldest: (a, b) => time(a) - time(b),
  name: (a, b) => a.name.localeCompare(b.name),
  largest: (a, b) => b.size - a.size,
  smallest: (a, b) => a.size - b.size,
};

/** Documents are previewed from object URLs we created, never from a remote origin. */
function isFrameable(src: string): boolean {
  return src.startsWith('blob:');
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
