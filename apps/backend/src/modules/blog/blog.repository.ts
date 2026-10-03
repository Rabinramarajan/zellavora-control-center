import { Prisma } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';
import { PostListQueryDto } from './blog.dto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

export const POST_INCLUDE = {
  author: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.BlogPostInclude;

export type PostRow = Prisma.BlogPostGetPayload<{ include: typeof POST_INCLUDE }>;

export class BlogRepository extends BaseRepository {
  async findById(organizationId: string, id: string, tx?: TxClient) {
    // uuid columns reject malformed ids with a 500; treat them as missing.
    if (!UUID.test(id)) return null;
    return this.getDb(tx).blogPost.findFirst({
      where: { id, organizationId, isDeleted: false },
      include: POST_INCLUDE,
    });
  }

  async slugTaken(organizationId: string, slug: string, exceptId?: string, tx?: TxClient) {
    const row = await this.getDb(tx).blogPost.findFirst({
      where: { organizationId, slug, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    return !!row;
  }

  /** Scheduled posts whose time has come become published (lazy, so no cron is needed). */
  async promoteDue(organizationId: string, now: Date, tx?: TxClient) {
    await this.getDb(tx).blogPost.updateMany({
      where: { organizationId, isDeleted: false, status: 'SCHEDULED', publishedAt: { lte: now } },
      data: { status: 'PUBLISHED' },
    });
  }

  async list(organizationId: string, q: PostListQueryDto, now: Date, tx?: TxClient) {
    const where: Prisma.BlogPostWhereInput = { organizationId, isDeleted: false };
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { slug: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    if (q.category) where.category = { equals: q.category, mode: 'insensitive' };
    if (q.status) where.status = q.status;
    if (q.period) where.createdAt = { gte: new Date(now.getTime() - Number(q.period) * DAY_MS) };

    const orderBy: Prisma.BlogPostOrderByWithRelationInput[] =
      q.sort === 'publishedAt'
        ? [{ publishedAt: { sort: q.order, nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ [q.sort]: q.order }];

    const [data, total] = await Promise.all([
      this.getDb(tx).blogPost.findMany({
        where,
        include: POST_INCLUDE,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.getDb(tx).blogPost.count({ where }),
    ]);
    return { data, total };
  }

  async statusCounts(organizationId: string, tx?: TxClient) {
    return this.getDb(tx).blogPost.groupBy({
      by: ['status'],
      where: { organizationId, isDeleted: false },
      _count: { _all: true },
      _sum: { viewCount: true },
    });
  }

  async countCreatedSince(organizationId: string, since: Date, tx?: TxClient) {
    return this.getDb(tx).blogPost.count({
      where: { organizationId, isDeleted: false, createdAt: { gte: since } },
    });
  }

  /** Daily counts for the stat-card sparklines (UTC days). */
  async daily(organizationId: string, since: Date) {
    return this.getDb().$queryRaw<
      Array<{ day: string; created: bigint; published: bigint; drafts: bigint; views: bigint }>
    >`
      SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             COUNT(*) AS created,
             COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published,
             COUNT(*) FILTER (WHERE status = 'DRAFT') AS drafts,
             COALESCE(SUM(view_count), 0) AS views
      FROM blog_posts
      WHERE organization_id = ${organizationId}::uuid
        AND is_deleted = false
        AND created_at >= ${since}
      GROUP BY 1`;
  }

  async categories(organizationId: string, tx?: TxClient) {
    const rows = await this.getDb(tx).blogPost.groupBy({
      by: ['category'],
      where: { organizationId, isDeleted: false },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => ({ name: r.category, count: r._count._all }));
  }

  async create(data: Prisma.BlogPostUncheckedCreateInput, tx?: TxClient) {
    return this.getDb(tx).blogPost.create({ data, include: POST_INCLUDE });
  }

  /** Optimistic update: resolves 0 when another save changed the row first. */
  async updateVersioned(
    id: string,
    version: number | undefined,
    data: Prisma.BlogPostUncheckedUpdateInput,
    tx?: TxClient
  ) {
    const res = await this.getDb(tx).blogPost.updateMany({
      where: { id, isDeleted: false, ...(version ? { version } : {}) },
      data: { ...data, version: { increment: 1 } },
    });
    return res.count;
  }

  async softDelete(id: string, actorId: string, tx?: TxClient) {
    return this.getDb(tx).blogPost.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: actorId,
        // (organization_id, slug) is unique; release the slug for reuse.
        slug: `${id}~deleted`,
      },
    });
  }
}
