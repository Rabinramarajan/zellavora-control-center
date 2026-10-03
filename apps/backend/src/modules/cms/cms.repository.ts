import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { PageListQueryDto } from './cms.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PAGE_SELECT = {
  id: true,
  organizationId: true,
  title: true,
  slug: true,
  status: true,
  type: true,
  template: true,
  parentId: true,
  metaTitle: true,
  metaDescription: true,
  seo: true,
  sections: true,
  schemaVersion: true,
  publishedAt: true,
  scheduledAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} satisfies Prisma.CmsPageSelect;

export type PageRow = Prisma.CmsPageGetPayload<{ select: typeof PAGE_SELECT }>;

export const PAGE_SUMMARY_SELECT = {
  id: true,
  title: true,
  slug: true,
  status: true,
  type: true,
  updatedAt: true,
  createdAt: true,
} satisfies Prisma.CmsPageSelect;

export type PageSummaryRow = Prisma.CmsPageGetPayload<{ select: typeof PAGE_SUMMARY_SELECT }>;

const REVISION_SELECT = {
  id: true,
  pageId: true,
  version: true,
  sections: true,
  savedBy: true,
  createdAt: true,
} satisfies Prisma.CmsPageRevisionSelect;

export type PageRevisionRow = Prisma.CmsPageRevisionGetPayload<{ select: typeof REVISION_SELECT }>;

export class CmsRepository extends BaseRepository {
  async findById(organizationId: string, id: string, tx?: TxClient) {
    if (!UUID.test(id)) return null;
    return this.getDb(tx).cmsPage.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: PAGE_SELECT,
    });
  }

  async slugTaken(organizationId: string, slug: string, exceptId?: string, tx?: TxClient) {
    const row = await this.getDb(tx).cmsPage.findFirst({
      where: { organizationId, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    return !!row;
  }

  async list(organizationId: string, q: PageListQueryDto, tx?: TxClient) {
    const where: Prisma.CmsPageWhereInput = { organizationId, isDeleted: false };
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { slug: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;

    const orderBy: Prisma.CmsPageOrderByWithRelationInput =
      q.sortBy === 'publishedAt'
        ? { publishedAt: { sort: q.sortDir, nulls: 'last' } }
        : { [q.sortBy]: q.sortDir };

    const [data, total] = await Promise.all([
      this.getDb(tx).cmsPage.findMany({
        where,
        select: PAGE_SUMMARY_SELECT,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.getDb(tx).cmsPage.count({ where }),
    ]);
    return { data, total };
  }

  async statusCounts(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).cmsPage.groupBy({
      by: ['status'],
      where: { organizationId, isDeleted: false },
      _count: { _all: true },
    });
  }

  async create(data: Prisma.CmsPageUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).cmsPage.create({ data, select: PAGE_SELECT });
  }

  async update(
    id: string,
    data: Prisma.CmsPageUncheckedUpdateInput,
    tx?: TxClient
  ) {
    return this.getDb(tx).cmsPage.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
      select: PAGE_SELECT,
    });
  }

  async updateVersioned(
    id: string,
    version: number | undefined,
    data: Prisma.CmsPageUncheckedUpdateInput,
    tx?: TxClient
  ) {
    const res = await this.getDb(tx).cmsPage.updateMany({
      where: { id, isDeleted: false, ...(version ? { version } : {}) },
      data: { ...data, version: { increment: 1 } },
    });
    return res.count;
  }

  async softDelete(id: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).cmsPage.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: actorId,
        slug: `${id}~deleted`,
      },
    });
  }

  // Revisions
  async createRevision(
    data: Prisma.CmsPageRevisionUncheckedCreateInput,
    tx?: TxClient
  ) {
    return this.getDb(tx).cmsPageRevision.create({ data, select: REVISION_SELECT });
  }

  async listRevisions(pageId: string, tx?: TxClient) {
    return this.getDb(tx).cmsPageRevision.findMany({
      where: { pageId },
      select: REVISION_SELECT,
      orderBy: { version: 'desc' },
      take: 50,
    });
  }

  async findRevision(pageId: string, revisionId: string, tx?: TxClient) {
    if (!UUID.test(revisionId)) return null;
    return this.getDb(tx).cmsPageRevision.findFirst({
      where: { id: revisionId, pageId },
      select: REVISION_SELECT,
    });
  }
}
