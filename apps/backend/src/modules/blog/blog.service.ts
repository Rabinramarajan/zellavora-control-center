import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import type { OrgContext } from '../../middleware/org-context';
import { BlogRepository, PostRow } from './blog.repository';
import { BlogStatus, CreatePostDto, PostListQueryDto, UpdatePostDto } from './blog.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const WORDS_PER_MINUTE = 220;

export interface BlogPostDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: string;
  tags: string[];
  coverImageUrl: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  viewCount: number;
  readingMinutes: number;
  seoTitle: string | null;
  seoDescription: string | null;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogStatsDto {
  total: number;
  published: number;
  drafts: number;
  scheduled: number;
  totalViews: number;
  createdThisMonth: number;
  /** Daily series (oldest first) for the last 30 days, for the stat-card sparklines. */
  trend: { created: number[]; published: number[]; drafts: number[]; views: number[] };
}

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'post';

export const readingMinutes = (content: string): number =>
  Math.max(1, Math.round(content.trim().split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE));

export const toPostDto = (p: PostRow): BlogPostDto => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt,
  content: p.content,
  category: p.category,
  tags: p.tags,
  coverImageUrl: p.coverImageUrl,
  status: p.status as BlogStatus,
  publishedAt: p.publishedAt?.toISOString() ?? null,
  viewCount: p.viewCount,
  readingMinutes: p.readingMinutes,
  seoTitle: p.seoTitle,
  seoDescription: p.seoDescription,
  author: p.author
    ? { id: p.author.id, name: p.author.fullName, avatarUrl: p.author.avatarUrl }
    : null,
  version: p.version,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const notFound = () => new AppError('Post not found', 404, 'POST_NOT_FOUND');

/** Blog / Insights: organization-scoped posts with drafts, scheduling and publishing. */
export class BlogService {
  constructor(private readonly repo = new BlogRepository()) {}

  async list(ctx: OrgContext, query: PostListQueryDto, now = new Date()) {
    await this.repo.promoteDue(ctx.organizationId, now);
    const { data, total } = await this.repo.list(ctx.organizationId, query, now);
    return {
      data: data.map(toPostDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async stats(ctx: OrgContext, now = new Date()): Promise<BlogStatsDto> {
    await this.repo.promoteDue(ctx.organizationId, now);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const since = new Date(today - (TREND_DAYS - 1) * DAY_MS);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [counts, createdThisMonth, daily] = await Promise.all([
      this.repo.statusCounts(ctx.organizationId),
      this.repo.countCreatedSince(ctx.organizationId, monthStart),
      this.repo.daily(ctx.organizationId, since),
    ]);
    const count = (s: BlogStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
    const byDay = new Map(daily.map((d) => [d.day, d]));
    const series = (pick: (d: (typeof daily)[number]) => bigint) =>
      Array.from({ length: TREND_DAYS }, (_, i) => {
        const d = byDay.get(new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10));
        return d ? Number(pick(d)) : 0;
      });

    return {
      total: counts.reduce((sum, c) => sum + c._count._all, 0),
      published: count('PUBLISHED'),
      drafts: count('DRAFT'),
      scheduled: count('SCHEDULED'),
      totalViews: counts.reduce((sum, c) => sum + (c._sum.viewCount ?? 0), 0),
      createdThisMonth,
      trend: {
        created: series((d) => d.created),
        published: series((d) => d.published),
        drafts: series((d) => d.drafts),
        views: series((d) => d.views),
      },
    };
  }

  categories(ctx: OrgContext) {
    return this.repo.categories(ctx.organizationId);
  }

  async get(ctx: OrgContext, id: string): Promise<BlogPostDto> {
    await this.repo.promoteDue(ctx.organizationId, new Date());
    const post = await this.repo.findById(ctx.organizationId, id);
    if (!post) throw notFound();
    return toPostDto(post);
  }

  async create(ctx: OrgContext, dto: CreatePostDto): Promise<BlogPostDto> {
    const slug = dto.slug
      ? await this.assertSlugFree(ctx.organizationId, dto.slug)
      : await this.uniqueSlug(ctx.organizationId, dto.title);
    const post = await this.repo.create({
      organizationId: ctx.organizationId,
      title: dto.title,
      slug,
      excerpt: dto.excerpt ?? null,
      content: dto.content,
      category: dto.category,
      tags: dto.tags,
      coverImageUrl: dto.coverImageUrl ?? null,
      seoTitle: dto.seoTitle ?? null,
      seoDescription: dto.seoDescription ?? null,
      readingMinutes: readingMinutes(dto.content),
      status: 'DRAFT',
      authorId: ctx.actorId,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
    });
    await this.audit(ctx, 'blog.post.created', post.id, { title: post.title });
    return toPostDto(post);
  }

  async update(ctx: OrgContext, id: string, dto: UpdatePostDto): Promise<BlogPostDto> {
    const existing = await this.repo.findById(ctx.organizationId, id);
    if (!existing) throw notFound();
    if (dto.slug && dto.slug !== existing.slug) {
      await this.assertSlugFree(ctx.organizationId, dto.slug, id);
    }
    const { version, ...fields } = dto;
    const changed = await this.repo.updateVersioned(id, version, {
      ...fields,
      ...(fields.content !== undefined ? { readingMinutes: readingMinutes(fields.content) } : {}),
      updatedBy: ctx.actorId,
    });
    if (!changed) {
      throw new AppError(
        'This post was changed by someone else. Reload it and try again.',
        409,
        'POST_VERSION_CONFLICT'
      );
    }
    await this.audit(ctx, 'blog.post.updated', id, { title: dto.title ?? existing.title });
    return this.get(ctx, id);
  }

  /** Publishes now, or schedules when `publishAt` is in the future. */
  async publish(ctx: OrgContext, id: string, publishAt?: Date, now = new Date()) {
    const post = await this.repo.findById(ctx.organizationId, id);
    if (!post) throw notFound();
    if (!post.content.trim()) {
      throw new AppError('Add some content before publishing.', 400, 'POST_EMPTY');
    }
    const scheduled = !!publishAt && publishAt.getTime() > now.getTime();
    await this.repo.updateVersioned(id, undefined, {
      status: scheduled ? 'SCHEDULED' : 'PUBLISHED',
      publishedAt: scheduled ? publishAt : (post.publishedAt ?? now),
      updatedBy: ctx.actorId,
    });
    await this.audit(ctx, scheduled ? 'blog.post.scheduled' : 'blog.post.published', id, {
      title: post.title,
      publishAt: scheduled ? publishAt!.toISOString() : now.toISOString(),
    });
    return this.get(ctx, id);
  }

  async unpublish(ctx: OrgContext, id: string) {
    const post = await this.repo.findById(ctx.organizationId, id);
    if (!post) throw notFound();
    await this.repo.updateVersioned(id, undefined, {
      status: 'DRAFT',
      // A scheduled date is dropped; a past publication date is kept for history.
      publishedAt: post.status === 'SCHEDULED' ? null : post.publishedAt,
      updatedBy: ctx.actorId,
    });
    await this.audit(ctx, 'blog.post.unpublished', id, { title: post.title });
    return this.get(ctx, id);
  }

  async duplicate(ctx: OrgContext, id: string): Promise<BlogPostDto> {
    const source = await this.repo.findById(ctx.organizationId, id);
    if (!source) throw notFound();
    const title = `${source.title} (Copy)`.slice(0, 200);
    return this.create(ctx, {
      title,
      slug: await this.uniqueSlug(ctx.organizationId, `${source.slug}-copy`),
      excerpt: source.excerpt,
      content: source.content,
      category: source.category,
      tags: source.tags,
      coverImageUrl: source.coverImageUrl,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
    });
  }

  async remove(ctx: OrgContext, id: string): Promise<{ success: true }> {
    const post = await this.repo.findById(ctx.organizationId, id);
    if (!post) throw notFound();
    await this.repo.softDelete(id, ctx.actorId);
    await this.audit(ctx, 'blog.post.deleted', id, { title: post.title });
    return { success: true };
  }

  private async assertSlugFree(organizationId: string, slug: string, exceptId?: string) {
    if (await this.repo.slugTaken(organizationId, slug, exceptId)) {
      throw new AppError(`The URL slug '${slug}' is already used`, 409, 'POST_SLUG_EXISTS');
    }
    return slug;
  }

  private async uniqueSlug(organizationId: string, text: string): Promise<string> {
    const base = slugify(text);
    let slug = base;
    for (let n = 2; await this.repo.slugTaken(organizationId, slug); n++) slug = `${base}-${n}`;
    return slug;
  }

  private audit(ctx: OrgContext, action: string, id: string, metadata: Record<string, unknown>) {
    return AuditService.log({
      action,
      resource: 'blog_post',
      resourceId: id,
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      severity: 'info',
      metadata,
    });
  }
}
