import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CmsBuilderApiService } from '../../../core/api/cms-builder.api';
import { errorMessage } from '../../iam/shared/iam-feedback.service';
import { IAM_BTN, IAM_INPUT } from '../../iam/shared/iam-page-header.component';
import { CmsPageType } from '../../../shared/models';

interface TypeOption {
  value: CmsPageType;
  label: string;
  icon: string;
  hint: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { value: 'STANDARD', label: 'Standard',  icon: 'pi-file',        hint: 'General purpose page' },
  { value: 'LANDING',  label: 'Landing',   icon: 'pi-megaphone',   hint: 'Marketing / conversion' },
  { value: 'ARTICLE',  label: 'Article',   icon: 'pi-book',        hint: 'Blog or content post' },
  { value: 'SYSTEM',   label: 'System',    icon: 'pi-cog',         hint: 'Error, legal, etc.' },
  { value: 'CUSTOM',   label: 'Custom',    icon: 'pi-sliders-h',   hint: 'Custom template' },
];

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');

@Component({
  selector: 'app-cms-create-page-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './cms-create-page-dialog.component.html',
  styleUrl: './cms-create-page-dialog.component.scss',
})
export class CmsCreatePageDialogComponent {
  private readonly api = inject(CmsBuilderApiService);

  readonly created = output<string>();
  readonly cancelled = output<void>();

  protected readonly btn = IAM_BTN;
  protected readonly inputClass = IAM_INPUT;
  protected readonly typeOptions = TYPE_OPTIONS;

  protected readonly title = signal('');
  protected readonly type = signal<CmsPageType>('STANDARD');
  protected readonly slug = signal('');
  protected readonly slugManuallyEdited = signal(false);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly serverError = signal<string | null>(null);

  protected readonly titleError = computed(() => {
    if (!this.submitted()) return null;
    const t = this.title().trim();
    if (!t) return 'Page title is required.';
    if (t.length > 120) return 'Title must be 120 characters or fewer.';
    return null;
  });

  protected readonly slugError = computed(() => {
    if (!this.submitted()) return null;
    const s = this.slug().trim();
    if (!s) return 'Slug is required.';
    if (!/^[a-z0-9/-]+$/.test(s)) return 'Use lowercase letters, numbers, hyphens and slashes.';
    return null;
  });

  protected readonly hasErrors = computed(() => !!(this.titleError() || this.slugError()));

  constructor() {
    effect(() => {
      const t = this.title();
      if (!this.slugManuallyEdited()) {
        this.slug.set(slugify(t) || '');
      }
    });
  }

  protected onTitleInput(e: Event): void {
    this.title.set((e.target as HTMLInputElement).value);
  }

  protected onSlugInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value;
    this.slug.set(val);
    this.slugManuallyEdited.set(true);
  }

  protected onSlugBlur(e: FocusEvent): void {
    const val = (e.target as HTMLInputElement).value;
    this.slug.set(slugify(val) || slugify(this.title()));
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.hasErrors() || this.saving()) return;

    this.saving.set(true);
    this.serverError.set(null);

    try {
      const page = await firstValueFrom(
        this.api.createPage({
          title: this.title().trim(),
          type: this.type(),
          slug: this.slug().trim() || slugify(this.title()),
        })
      );
      this.created.emit(page.id);
    } catch (err) {
      this.serverError.set(errorMessage(err, 'Failed to create page.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected onBackdropClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('cms-dialog-backdrop')) {
      this.cancel();
    }
  }
}
