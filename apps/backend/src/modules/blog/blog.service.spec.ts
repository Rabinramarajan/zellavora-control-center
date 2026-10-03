import { BlogService, readingMinutes, slugify } from './blog.service';
import { BlogRepository } from './blog.repository';
import { CreatePostSchema, PostListQuerySchema } from './blog.dto';

jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

const ORG = '00000000-0000-4000-8000-000000000900';
const ACTOR = '00000000-0000-4000-8000-000000000099';
const ctx = { organizationId: ORG, actorId: ACTOR };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-10-03T12:00:00Z');

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n),
  organizationId: ORG,
  title: `Post ${n}`,
  slug: `post-${n}`,
  excerpt: null,
  content: 'Some words here',
  category: 'Tutorial',
  tags: [],
  coverImageUrl: null,
  status: 'DRAFT',
  publishedAt: null,
  viewCount: 0,
  readingMinutes: 1,
  seoTitle: null,
  seoDescription: null,
  authorId: ACTOR,
  isDeleted: false,
  deletedAt: null,
  createdBy: ACTOR,
  updatedBy: ACTOR,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
  author: { id: ACTOR, fullName: 'Rabin R', avatarUrl: null },
  ...extra,
});

function makeRepo(overrides: Partial<Record<keyof BlogRepository, jest.Mock>> = {}) {
  const repo = {
    findById: jest.fn().mockResolvedValue(row(1)),
    slugTaken: jest.fn().mockResolvedValue(false),
    promoteDue: jest.fn(),
    list: jest.fn().mockResolvedValue({ data: [row(1)], total: 1 }),
    statusCounts: jest.fn().mockResolvedValue([]),
    countCreatedSince: jest.fn().mockResolvedValue(0),
    daily: jest.fn().mockResolvedValue([]),
    categories: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (data: Record<string, unknown>) => row(1, data)),
    updateVersioned: jest.fn().mockResolvedValue(1),
    softDelete: jest.fn(),
    ...overrides,
  };
  return repo as unknown as BlogRepository & typeof repo;
}

describe('blog helpers', () => {
  it('builds URL-safe slugs', () => {
    expect(slugify('Angular 22 Signals: The Future!')).toBe('angular-22-signals-the-future');
    expect(slugify('Café & Crème')).toBe('cafe-creme');
    expect(slugify('!!!')).toBe('post');
  });

  it('estimates reading time with a one-minute floor', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(660))).toBe(3);
  });
});

describe('BlogService', () => {
  it('creates drafts with a unique slug derived from the title', async () => {
    const repo = makeRepo({
      slugTaken: jest.fn(async (_o: string, s: string) => s === 'hello-world'),
    });
    await new BlogService(repo).create(
      ctx,
      CreatePostSchema.parse({ title: 'Hello World', category: 'Tutorial' })
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'hello-world-2', status: 'DRAFT', authorId: ACTOR })
    );
  });

  it('rejects an explicit slug that is already used', async () => {
    const repo = makeRepo({ slugTaken: jest.fn().mockResolvedValue(true) });
    await expect(
      new BlogService(repo).create(
        ctx,
        CreatePostSchema.parse({ title: 'Hello', slug: 'taken', category: 'Tutorial' })
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('promotes due scheduled posts before listing', async () => {
    const repo = makeRepo();
    await new BlogService(repo).list(ctx, PostListQuerySchema.parse({}), NOW);
    expect(repo.promoteDue).toHaveBeenCalledWith(ORG, NOW);
  });

  it('schedules when the publish time is in the future', async () => {
    const repo = makeRepo();
    const later = new Date(NOW.getTime() + 86_400_000);
    await new BlogService(repo).publish(ctx, id(1), later, NOW);
    expect(repo.updateVersioned).toHaveBeenCalledWith(
      id(1),
      undefined,
      expect.objectContaining({ status: 'SCHEDULED', publishedAt: later })
    );
  });

  it('publishes now when no future time is given', async () => {
    const repo = makeRepo();
    await new BlogService(repo).publish(ctx, id(1), undefined, NOW);
    expect(repo.updateVersioned).toHaveBeenCalledWith(
      id(1),
      undefined,
      expect.objectContaining({ status: 'PUBLISHED', publishedAt: NOW })
    );
  });

  it('refuses to publish an empty post', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(row(1, { content: '  ' })) });
    await expect(new BlogService(repo).publish(ctx, id(1), undefined, NOW)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('drops the scheduled date when unpublishing a scheduled post', async () => {
    const repo = makeRepo({
      findById: jest
        .fn()
        .mockResolvedValue(row(1, { status: 'SCHEDULED', publishedAt: new Date('2027-01-01') })),
    });
    await new BlogService(repo).unpublish(ctx, id(1));
    expect(repo.updateVersioned).toHaveBeenCalledWith(
      id(1),
      undefined,
      expect.objectContaining({ status: 'DRAFT', publishedAt: null })
    );
  });

  it('reports a conflict when the post changed since it was loaded', async () => {
    const repo = makeRepo({ updateVersioned: jest.fn().mockResolvedValue(0) });
    await expect(
      new BlogService(repo).update(ctx, id(1), { title: 'New title', version: 1 })
    ).rejects.toMatchObject({ status: 409, code: 'POST_VERSION_CONFLICT' });
  });

  it('builds 30-day zero-filled trends and status totals', async () => {
    const repo = makeRepo({
      statusCounts: jest.fn().mockResolvedValue([
        { status: 'PUBLISHED', _count: { _all: 3 }, _sum: { viewCount: 120 } },
        { status: 'DRAFT', _count: { _all: 1 }, _sum: { viewCount: 0 } },
      ]),
      daily: jest
        .fn()
        .mockResolvedValue([
          { day: '2026-10-03', created: 2n, published: 1n, drafts: 1n, views: 40n },
        ]),
    });
    const stats = await new BlogService(repo).stats(ctx, NOW);
    expect(stats).toMatchObject({ total: 4, published: 3, drafts: 1, totalViews: 120 });
    expect(stats.trend.created).toHaveLength(30);
    expect(stats.trend.created[29]).toBe(2);
  });

  it('returns 404 for a post from another organization', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    await expect(new BlogService(repo).get(ctx, id(1))).rejects.toMatchObject({ status: 404 });
  });
});
