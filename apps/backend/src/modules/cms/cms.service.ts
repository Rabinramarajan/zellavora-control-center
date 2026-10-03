import { Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import type { OrgContext } from '../../middleware/org-context';
import { CmsRepository, PageRow, PageRevisionRow } from './cms.repository';
import {
  CmsPageStatus,
  CmsPageType,
  CreatePageDto,
  PageListQueryDto,
  SaveBuilderDto,
  UpdatePageDto,
} from './cms.dto';

export interface CmsPageDto {
  id: string;
  organizationId: string;
  title: string;
  slug: string;
  status: CmsPageStatus;
  type: CmsPageType;
  template: string | null;
  parentId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  seo: Prisma.JsonValue;
  sections: Prisma.JsonValue;
  schemaVersion: number;
  publishedAt: string | null;
  scheduledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CmsPageSummaryDto {
  id: string;
  title: string;
  slug: string;
  status: CmsPageStatus;
  type: CmsPageType;
  updatedAt: string;
  createdAt: string;
}

export interface CmsPageStatsDto {
  total: number;
  published: number;
  draft: number;
  scheduled: number;
  archived: number;
}

export interface CmsRevisionDto {
  id: string;
  pageId: string;
  version: number;
  sections: Prisma.JsonValue;
  savedBy: string | null;
  createdAt: string;
}

const toDto = (p: PageRow): CmsPageDto => ({
  id: p.id,
  organizationId: p.organizationId,
  title: p.title,
  slug: p.slug,
  status: p.status as CmsPageStatus,
  type: p.type as CmsPageType,
  template: p.template,
  parentId: p.parentId,
  metaTitle: p.metaTitle,
  metaDescription: p.metaDescription,
  seo: p.seo,
  sections: p.sections,
  schemaVersion: p.schemaVersion,
  publishedAt: p.publishedAt?.toISOString() ?? null,
  scheduledAt: p.scheduledAt?.toISOString() ?? null,
  version: p.version,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
  createdBy: p.createdBy,
});

const toSummaryDto = (p: { id: string; title: string; slug: string; status: string; type: string; updatedAt: Date; createdAt: Date }): CmsPageSummaryDto => ({
  id: p.id,
  title: p.title,
  slug: p.slug,
  status: p.status as CmsPageStatus,
  type: p.type as CmsPageType,
  updatedAt: p.updatedAt.toISOString(),
  createdAt: p.createdAt.toISOString(),
});

const toRevisionDto = (r: PageRevisionRow): CmsRevisionDto => ({
  id: r.id,
  pageId: r.pageId,
  version: r.version,
  sections: r.sections,
  savedBy: r.savedBy,
  createdAt: r.createdAt.toISOString(),
});

const notFound = () => new AppError('Page not found', 404, 'CMS_PAGE_NOT_FOUND');

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'page';

export class CmsService {
  constructor(private readonly repo = new CmsRepository()) {}

  async list(ctx: OrgContext, query: PageListQueryDto) {
    const { data, total } = await this.repo.list(ctx.organizationId, query);
    return {
      items: data.map(toSummaryDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async stats(ctx: OrgContext): Promise<CmsPageStatsDto> {
    const counts = await this.repo.statusCounts(ctx.organizationId);
    const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
    return {
      total: counts.reduce((sum, c) => sum + c._count._all, 0),
      published: count('PUBLISHED'),
      draft: count('DRAFT'),
      scheduled: count('SCHEDULED'),
      archived: count('ARCHIVED'),
    };
  }

  async get(ctx: OrgContext, id: string): Promise<CmsPageDto> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();
    return toDto(page);
  }

  async create(ctx: OrgContext, dto: CreatePageDto): Promise<CmsPageDto> {
    const slug = dto.slug
      ? await this.assertSlugFree(ctx.organizationId, dto.slug)
      : await this.uniqueSlug(ctx.organizationId, dto.title);

    const page = await this.repo.create({
      organizationId: ctx.organizationId,
      title: dto.title,
      slug,
      type: dto.type,
      template: dto.template ?? null,
      parentId: dto.parentId ?? null,
      status: 'DRAFT',
      sections: Prisma.JsonNull,
      seo: Prisma.JsonNull,
      schemaVersion: 1,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.created', page.id, { title: page.title, slug: page.slug });
    return toDto(page);
  }

  async update(ctx: OrgContext, id: string, dto: UpdatePageDto): Promise<CmsPageDto> {
    const existing = await this.repo.findById(ctx.organizationId, id);
    if (!existing) throw notFound();

    const updated = await this.repo.update(id, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.metaTitle !== undefined ? { metaTitle: dto.metaTitle } : {}),
      ...(dto.metaDescription !== undefined ? { metaDescription: dto.metaDescription } : {}),
      ...(dto.seo !== undefined ? { seo: dto.seo as Prisma.InputJsonValue } : {}),
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.updated', id, { title: updated.title });
    return toDto(updated);
  }

  async remove(ctx: OrgContext, id: string): Promise<{ success: true }> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();
    await this.repo.softDelete(id, ctx.actorId);
    await this.audit(ctx, 'cms.page.deleted', id, { title: page.title });
    return { success: true };
  }

  async duplicate(ctx: OrgContext, id: string): Promise<CmsPageDto> {
    const source = await this.repo.findById(ctx.organizationId, id);
    if (!source) throw notFound();
    const title = `${source.title} (Copy)`.slice(0, 200);
    const slug = await this.uniqueSlug(ctx.organizationId, `${source.slug}-copy`);

    const page = await this.repo.create({
      organizationId: ctx.organizationId,
      title,
      slug,
      type: source.type,
      template: source.template ?? null,
      parentId: source.parentId ?? null,
      status: 'DRAFT',
      metaTitle: source.metaTitle ?? null,
      metaDescription: source.metaDescription ?? null,
      seo: (source.seo ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      sections: (source.sections ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      schemaVersion: source.schemaVersion,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.duplicated', page.id, { sourceId: id, title: page.title });
    return toDto(page);
  }

  async publish(ctx: OrgContext, id: string): Promise<CmsPageDto> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();

    const updated = await this.repo.update(id, {
      status: 'PUBLISHED',
      publishedAt: page.publishedAt ?? new Date(),
      scheduledAt: null,
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.published', id, { title: page.title });
    return toDto(updated);
  }

  async unpublish(ctx: OrgContext, id: string): Promise<CmsPageDto> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();

    const updated = await this.repo.update(id, {
      status: 'DRAFT',
      scheduledAt: null,
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.unpublished', id, { title: page.title });
    return toDto(updated);
  }

  async schedule(ctx: OrgContext, id: string, scheduledAt: Date): Promise<CmsPageDto> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();

    const updated = await this.repo.update(id, {
      status: 'SCHEDULED',
      scheduledAt,
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.scheduled', id, {
      title: page.title,
      scheduledAt: scheduledAt.toISOString(),
    });
    return toDto(updated);
  }

  async saveBuilder(ctx: OrgContext, id: string, dto: SaveBuilderDto): Promise<CmsPageDto> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();

    // Save a revision before overwriting
    await this.repo.createRevision({
      pageId: id,
      version: page.version,
      sections: (page.sections ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      savedBy: ctx.actorId,
    });

    const updated = await this.repo.updateVersioned(id, dto.version, {
      sections: dto.sections as Prisma.InputJsonValue,
      updatedBy: ctx.actorId,
    });

    if (!updated) {
      throw new AppError(
        'This page was changed by someone else. Reload it and try again.',
        409,
        'CMS_PAGE_VERSION_CONFLICT'
      );
    }

    return this.get(ctx, id);
  }

  async getVersions(ctx: OrgContext, id: string): Promise<CmsRevisionDto[]> {
    const page = await this.repo.findById(ctx.organizationId, id);
    if (!page) throw notFound();
    const revisions = await this.repo.listRevisions(id);
    return revisions.map(toRevisionDto);
  }

  async restoreVersion(ctx: OrgContext, pageId: string, revisionId: string): Promise<CmsPageDto> {
    const page = await this.repo.findById(ctx.organizationId, pageId);
    if (!page) throw notFound();

    const revision = await this.repo.findRevision(pageId, revisionId);
    if (!revision) throw new AppError('Revision not found', 404, 'CMS_REVISION_NOT_FOUND');

    // Save current state as a revision
    await this.repo.createRevision({
      pageId,
      version: page.version,
      sections: (page.sections ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      savedBy: ctx.actorId,
    });

    const updated = await this.repo.update(pageId, {
      sections: revision.sections as Prisma.InputJsonValue,
      updatedBy: ctx.actorId,
    });

    await this.audit(ctx, 'cms.page.version_restored', pageId, {
      title: page.title,
      restoredVersion: revision.version,
    });

    return toDto(updated);
  }

  async checkSlug(
    ctx: OrgContext,
    slug: string,
    excludeId?: string
  ): Promise<{ available: boolean }> {
    const taken = await this.repo.slugTaken(ctx.organizationId, slug, excludeId);
    return { available: !taken };
  }

  private async assertSlugFree(organizationId: string, slug: string, exceptId?: string) {
    if (await this.repo.slugTaken(organizationId, slug, exceptId)) {
      throw new AppError(`The URL slug '${slug}' is already used`, 409, 'CMS_SLUG_EXISTS');
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
      resource: 'cms_page',
      resourceId: id,
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      severity: 'info',
      metadata,
    });
  }
}
