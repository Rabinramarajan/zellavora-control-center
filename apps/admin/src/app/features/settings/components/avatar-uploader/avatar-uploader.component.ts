import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_UPLOAD_MB,
  AVATAR_OUTPUT_SIZE_PX,
} from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

@Component({
  selector: 'app-avatar-uploader',
  standalone: true,
  imports: [SettingsIconComponent],
  template: `
    <div class="py-5 flex flex-col sm:flex-row sm:items-center gap-5">
      <button
        type="button"
        (click)="fileInput.click()"
        [disabled]="busy()"
        [attr.aria-label]="avatarUrl() ? 'Change profile picture' : 'Upload profile picture'"
        class="group relative w-24 h-24 shrink-0 rounded-full p-[3px] bg-gradient-to-br from-violet-500 to-indigo-500 cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05040e]"
      >
        <span
          class="relative flex w-full h-full rounded-full overflow-hidden bg-[#0c0a1f] items-center justify-center"
        >
          @if (avatarUrl() && !imageFailed()) {
            <img
              [src]="avatarUrl()"
              alt=""
              class="w-full h-full object-cover"
              (error)="imageFailed.set(true)"
              (load)="imageFailed.set(false)"
            />
          } @else {
            <span class="text-2xl font-bold text-violet-200">{{ initials() }}</span>
          }
          <span
            class="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200"
            [class.opacity-100]="busy()"
            aria-hidden="true"
          >
            @if (busy()) {
              <span
                class="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin motion-reduce:animate-none"
              ></span>
            } @else {
              <app-settings-icon name="image" sizeClass="w-6 h-6" />
            }
          </span>
        </span>
      </button>

      <div class="space-y-3 min-w-0">
        <div>
          <p class="text-sm font-semibold text-white">Profile picture</p>
          <p class="text-[11px] text-slate-400 mt-1">
            PNG, JPEG or WebP, up to {{ maxUploadMb }} MB. Cropped to a square.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="fileInput.click()"
            [disabled]="busy()"
            class="min-h-[44px] px-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {{ busy() ? 'Uploading…' : avatarUrl() ? 'Change photo' : 'Upload photo' }}
          </button>
          @if (avatarUrl()) {
            <button
              type="button"
              (click)="avatarRemove.emit()"
              [disabled]="busy()"
              class="min-h-[44px] px-4 text-xs font-semibold text-slate-300 hover:text-red-300 rounded-xl cursor-pointer transition-colors duration-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
            >
              Remove
            </button>
          }
        </div>
        <p aria-live="polite" class="text-[11px] text-red-300 min-h-[1em]">{{ error() }}</p>
      </div>

      <input
        #fileInput
        type="file"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        [accept]="acceptedTypes"
        (change)="onFileChange($event)"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarUploaderComponent {
  readonly avatarUrl = input<string | null>(null);
  readonly name = input('');
  readonly busy = input(false);

  /** Emits a square, resized image as a WebP data URL. */
  readonly avatarChange = output<string>();
  readonly avatarRemove = output<void>();

  protected readonly acceptedTypes = AVATAR_ACCEPTED_TYPES.join(',');
  protected readonly maxUploadMb = AVATAR_MAX_UPLOAD_MB;
  protected readonly imageFailed = signal(false);
  protected readonly error = signal('');

  protected readonly initials = computed(
    () =>
      this.name()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]!.toUpperCase())
        .join('') || '?'
  );

  protected async onFileChange(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;

    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      this.error.set('Please choose a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > AVATAR_MAX_UPLOAD_MB * 1024 * 1024) {
      this.error.set(`Image must be ${AVATAR_MAX_UPLOAD_MB} MB or smaller.`);
      return;
    }

    try {
      this.error.set('');
      this.imageFailed.set(false);
      this.avatarChange.emit(await toSquareWebp(file, AVATAR_OUTPUT_SIZE_PX));
    } catch {
      this.error.set('That image could not be read. Try a different file.');
    }
  }
}

async function toSquareWebp(file: File, size: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    bitmap.close();
  }
}
