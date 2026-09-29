import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_UPLOAD_MB,
  AVATAR_OUTPUT_SIZE_PX,
} from '../../models/settings.model';
import { SettingsIconComponent } from '../settings-icon/settings-icon.component';

/** Profile header: cover band, avatar with upload/remove actions, and identity summary. */
@Component({
  selector: 'app-avatar-uploader',
  standalone: true,
  imports: [SettingsIconComponent],
  template: `
    <section class="glass-panel rounded-3xl overflow-hidden" aria-label="Profile picture">
      <!-- Cover band fades out instead of ending on a hard edge -->
      <div
        class="h-20 sm:h-24 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(139,92,246,0.5),transparent_60%),radial-gradient(100%_120%_at_100%_0%,rgba(79,70,229,0.4),transparent_55%)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        aria-hidden="true"
      ></div>

      <div class="px-6 sm:px-8 pb-6 -mt-10 flex flex-col sm:flex-row gap-4 sm:gap-5">
        <button
          type="button"
          (click)="fileInput.click()"
          [disabled]="busy()"
          [attr.aria-label]="avatarUrl() ? 'Change profile picture' : 'Upload profile picture'"
          class="group relative w-24 h-24 shrink-0 rounded-full p-[3px] bg-gradient-to-br from-violet-400 via-fuchsia-500 to-indigo-500 shadow-xl shadow-black/40 cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          <span
            class="relative flex w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-700 items-center justify-center"
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
              <span class="text-2xl font-bold text-white">{{ initials() }}</span>
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
          <span
            class="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-violet-600 border-[3px] border-[#0c0b1d] text-white flex items-center justify-center"
            aria-hidden="true"
          >
            <app-settings-icon name="image" sizeClass="w-3.5 h-3.5" />
          </span>
        </button>

        <!-- Text and actions start below the cover band so nothing sits on its edge -->
        <div class="min-w-0 flex-1 sm:pt-12 flex flex-col sm:flex-row sm:items-start gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-lg font-bold text-white leading-tight truncate">
                {{ name() || 'Your name' }}
              </p>
              @if (role()) {
                <span
                  class="px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/25 text-[11px] font-semibold capitalize text-violet-200"
                >
                  {{ role() }}
                </span>
              }
            </div>
            @if (email()) {
              <p class="text-xs text-slate-400 mt-1.5 truncate">{{ email() }}</p>
            }
            <p class="text-[11px] mt-3" aria-live="polite">
              @if (error()) {
                <span class="text-red-300">{{ error() }}</span>
              } @else {
                <span class="text-slate-500"
                  >PNG, JPEG or WebP up to {{ maxUploadMb }} MB · cropped to a square</span
                >
              }
            </p>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            @if (avatarUrl()) {
              <button
                type="button"
                (click)="avatarRemove.emit()"
                [disabled]="busy()"
                class="min-h-[44px] px-4 text-xs font-semibold text-slate-300 hover:text-red-300 hover:bg-red-500/10 rounded-xl cursor-pointer transition-colors duration-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                Remove
              </button>
            }
            <button
              type="button"
              (click)="fileInput.click()"
              [disabled]="busy()"
              class="min-h-[44px] px-5 border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white font-semibold text-xs rounded-xl cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              {{ busy() ? 'Uploading…' : avatarUrl() ? 'Change photo' : 'Upload photo' }}
            </button>
          </div>
        </div>
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
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarUploaderComponent {
  readonly avatarUrl = input<string | null>(null);
  readonly name = input('');
  readonly email = input('');
  readonly role = input('');
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
