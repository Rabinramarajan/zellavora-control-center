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
  templateUrl: './avatar-uploader.component.html',
  styleUrl: './avatar-uploader.component.scss',
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
