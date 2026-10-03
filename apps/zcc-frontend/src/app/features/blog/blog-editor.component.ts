import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { BlogApiService } from '../../core/api/blog.api';
import { PermissionService } from '../../core/rbac/services/permission.service';
import { BlogPost, SavePostRequest } from '../../shared/models/blog.model';
import { EmptyStateComponent } from '../../shared/components/iam';
import { IamDialogsService } from '../iam/shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../iam/shared/iam-feedback.service';
import { formatDateTime } from '../iam/shared/iam-format';
import { STATUS_LABEL, SUGGESTED_CATEGORIES, categoryTone } from './blog-ui';

interface Draft {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
}

/** One rendered block of the lightweight content format used by the preview. */
type Block =
  { kind: 'h2' | 'h3' | 'p' | 'quote'; text: string } | { kind: 'list'; items: string[] };

const EMPTY: Draft = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  category: '',
  tags: [],
  coverImageUrl: '',
  seoTitle: '',
  seoDescription: '',
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORDS_PER_MINUTE = 220;

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

/**
 * Parses the editor's plain-text format into blocks: `## ` and `### ` headings, `> ` quotes,
 * `- ` list items and blank-line separated paragraphs. Rendered with text bindings only, so
 * content can never inject markup.
 */
export const parseContent = (content: string): Block[] => {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flush = (): void => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
    if (list.length) blocks.push({ kind: 'list', items: list });
    para = [];
    list = [];
  };
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'h3', text: line.slice(4) });
    } else if (line.startsWith('## ') || line.startsWith('# ')) {
      flush();
      blocks.push({ kind: 'h2', text: line.replace(/^#{1,2}\s/, '') });
    } else if (line.startsWith('> ')) {
      flush();
      blocks.push({ kind: 'quote', text: line.slice(2) });
    } else if (/^[-*] /.test(line)) {
      if (para.length) flush();
      list.push(line.slice(2));
    } else {
      if (list.length) flush();
      para.push(line);
    }
  }
  flush();
  return blocks;
};

const toDraft = (p: BlogPost): Draft => ({
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt ?? '',
  content: p.content,
  category: p.category,
  tags: [...p.tags],
  coverImageUrl: p.coverImageUrl ?? '',
  seoTitle: p.seoTitle ?? '',
  seoDescription: p.seoDescription ?? '',
});

/** `YYYY-MM-DDTHH:mm` in local time, the value format of `<input type="datetime-local">`. */
const toLocalInput = (d: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

@Component({
  selector: 'app-blog-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EmptyStateComponent],
  templateUrl: './blog-editor.component.html',
  styleUrl: './blog-editor.component.scss',
})
export class BlogEditorComponent {
  private readonly api = inject(BlogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canManage = inject(PermissionService).can('blog:manage');

  private readonly postId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: null,
  });

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly categoryTone = categoryTone;
  protected readonly dateTime = formatDateTime;

  protected readonly post = signal<BlogPost | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly busy = signal(false);
  protected readonly view = signal<'write' | 'preview'>(
    this.route.snapshot.queryParamMap.get('view') === 'preview' ? 'preview' : 'write'
  );
  protected readonly draft = signal<Draft>({ ...EMPTY });
  private readonly baseline = signal(JSON.stringify(EMPTY));
  /** True until the slug is edited by hand; until then it follows the title. */
  protected readonly slugAuto = signal(true);
  protected readonly scheduleOpen = signal(false);
  protected readonly scheduleAt = signal(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  protected readonly tagInput = signal('');
  protected readonly categories = signal<string[]>(SUGGESTED_CATEGORIES);
  private leaving = false;

  protected readonly isNew = computed(() => !this.postId());
  protected readonly readOnly = computed(() => !this.canManage());
  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== this.baseline());
  protected readonly blocks = computed(() => parseContent(this.draft().content));
  protected readonly words = computed(
    () => this.draft().content.trim().split(/\s+/).filter(Boolean).length
  );
  protected readonly minutes = computed(() =>
    Math.max(1, Math.round(this.words() / WORDS_PER_MINUTE))
  );
  protected readonly live = computed(() => {
    const s = this.post()?.status;
    return s === 'PUBLISHED' || s === 'SCHEDULED';
  });

  protected readonly errors = computed(() => {
    const d = this.draft();
    const e: Partial<Record<keyof Draft, string>> = {};
    if (d.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (d.title.length > 200) e.title = 'Keep the title under 200 characters';
    if (d.slug && !SLUG.test(d.slug)) e.slug = 'Use lowercase letters, numbers and hyphens';
    if (d.category.trim().length < 2) e.category = 'Choose a category';
    if (d.excerpt.length > 400) e.excerpt = 'Keep the excerpt under 400 characters';
    if (d.coverImageUrl.trim()) {
      try {
        if (new URL(d.coverImageUrl.trim()).protocol !== 'https:')
          e.coverImageUrl = 'Use an https:// URL';
      } catch {
        e.coverImageUrl = 'Enter a valid URL';
      }
    }
    if (d.seoTitle.length > 70) e.seoTitle = 'Search engines show about 60–70 characters';
    if (d.seoDescription.length > 160) e.seoDescription = 'Keep it under 160 characters';
    return e;
  });
  protected readonly valid = computed(() => Object.keys(this.errors()).length === 0);
  protected readonly touched = signal(false);

  public constructor() {
    effect(() => {
      const id = this.postId();
      if (id) void this.load(id);
      else this.reset(null);
    });
    void this.loadCategories();
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.reset(await firstValueFrom(this.api.get(id)));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Post not found.'));
    } finally {
      this.loading.set(false);
    }
  }

  private reset(post: BlogPost | null): void {
    this.post.set(post);
    const draft = post ? toDraft(post) : { ...EMPTY };
    this.draft.set(draft);
    this.baseline.set(JSON.stringify(draft));
    this.slugAuto.set(!post);
    this.touched.set(false);
  }

  private async loadCategories(): Promise<void> {
    try {
      const used = (await firstValueFrom(this.api.categories())).map((c) => c.name);
      this.categories.set([...new Set([...used, ...SUGGESTED_CATEGORIES])].sort());
    } catch {
      // Suggestions still work offline.
    }
  }

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  protected set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected setTitle(title: string): void {
    this.draft.update((d) => ({ ...d, title, slug: this.slugAuto() ? slugify(title) : d.slug }));
  }

  protected setSlug(value: string): void {
    this.slugAuto.set(false);
    this.set('slug', value.toLowerCase().replace(/\s+/g, '-'));
  }

  protected regenerateSlug(): void {
    this.slugAuto.set(true);
    this.set('slug', slugify(this.draft().title));
  }

  protected onTagKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag();
    } else if (event.key === 'Backspace' && !this.tagInput() && this.draft().tags.length) {
      this.removeTag(this.draft().tags.length - 1);
    }
  }

  protected addTag(): void {
    const tag = this.tagInput().trim().toLowerCase().slice(0, 30);
    this.tagInput.set('');
    const tags = this.draft().tags;
    if (!tag || tags.includes(tag) || tags.length >= 10) return;
    this.set('tags', [...tags, tag]);
  }

  protected removeTag(index: number): void {
    this.set(
      'tags',
      this.draft().tags.filter((_, i) => i !== index)
    );
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  private request(): SavePostRequest {
    const d = this.draft();
    return {
      title: d.title.trim(),
      ...(d.slug ? { slug: d.slug } : {}),
      excerpt: d.excerpt.trim() || null,
      content: d.content,
      category: d.category.trim(),
      tags: d.tags,
      coverImageUrl: d.coverImageUrl.trim() || null,
      seoTitle: d.seoTitle.trim() || null,
      seoDescription: d.seoDescription.trim() || null,
    };
  }

  /** Saves the draft; resolves the saved post, or null when validation or the API failed. */
  protected async save(silent = false): Promise<BlogPost | null> {
    this.touched.set(true);
    if (!this.valid()) {
      this.feedback.error(null, 'Fix the highlighted fields first.');
      return null;
    }
    this.saving.set(true);
    try {
      const current = this.post();
      const saved = current
        ? await firstValueFrom(
            this.api.update(current.id, { ...this.request(), version: current.version })
          )
        : await firstValueFrom(this.api.create(this.request()));
      this.reset(saved);
      if (!silent) this.feedback.success(current ? 'Changes saved.' : 'Draft created.');
      if (!current) {
        this.leaving = true;
        await this.router.navigate(['/blog', saved.id, 'edit'], { replaceUrl: true });
        this.leaving = false;
      }
      return saved;
    } catch (err) {
      this.feedback.error(err, 'Could not save the post.');
      return null;
    } finally {
      this.saving.set(false);
    }
  }

  protected async publish(schedule: boolean): Promise<void> {
    if (!this.draft().content.trim()) {
      this.feedback.error(null, 'Add some content before publishing.');
      return;
    }
    let publishAt: string | undefined;
    if (schedule) {
      const at = new Date(this.scheduleAt());
      if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) {
        this.feedback.error(null, 'Choose a date and time in the future.');
        return;
      }
      publishAt = at.toISOString();
    }
    const saved = this.dirty() || !this.post() ? await this.save(true) : this.post();
    if (!saved) return;
    await this.run(async () => {
      this.reset(await firstValueFrom(this.api.publish(saved.id, publishAt)));
      this.scheduleOpen.set(false);
      this.feedback.success(schedule ? 'Post scheduled.' : 'Post published.');
    });
  }

  protected async unpublish(): Promise<void> {
    const p = this.post();
    if (!p) return;
    const ok = await this.dialogs.confirm(
      'Move back to drafts?',
      p.status === 'SCHEDULED'
        ? 'The scheduled publication is cancelled.'
        : 'Readers will no longer see this post.',
      'Unpublish'
    );
    if (!ok) return;
    await this.run(async () => {
      this.reset(await firstValueFrom(this.api.unpublish(p.id)));
      this.feedback.success('Moved back to drafts.');
    });
  }

  protected async remove(): Promise<void> {
    const p = this.post();
    if (!p) return;
    const ok = await this.dialogs.confirm(
      `Delete “${p.title}”?`,
      'This cannot be undone.',
      'Delete',
      true
    );
    if (!ok) return;
    await this.run(async () => {
      await firstValueFrom(this.api.remove(p.id));
      this.leaving = true;
      this.feedback.success('Post deleted.');
      await this.router.navigate(['/blog']);
    });
  }

  protected discard(): void {
    this.reset(this.post());
  }

  /** Used by the route's canDeactivate guard. */
  public canLeave(): boolean | Promise<boolean> {
    if (this.leaving || this.readOnly() || !this.dirty()) return true;
    return this.dialogs.confirm(
      'Discard changes?',
      'You have unsaved changes to this post. Leave and discard them?',
      'Discard',
      true
    );
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  protected minSchedule(): string {
    return toLocalInput(new Date(Date.now() + 60_000));
  }
}
