import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import { PortfolioService } from './portfolio.service';
import { PortfolioRepository, sameIdSet } from './portfolio.repository';
import { PORTFOLIO_ITEM_LIMIT } from './portfolio.dto';

describe('sameIdSet (reorder guard)', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';

  it('accepts a permutation of exactly the live ids', () => {
    expect(sameIdSet([A, B], [B, A])).toBe(true);
  });

  it('rejects a partial list, which would drop the other rows from the order', () => {
    expect(sameIdSet([A, B], [B])).toBe(false);
  });

  it('rejects an id that is not a live row', () => {
    expect(sameIdSet([A], [B])).toBe(false);
  });
});

jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

const ORG = '00000000-0000-4000-8000-000000000900';
const ACTOR = '00000000-0000-4000-8000-000000000099';
const ITEM = '00000000-0000-4000-8000-000000000042';
const ctx = { organizationId: ORG, actorId: ACTOR };
const NOW = new Date('2026-10-13T12:00:00Z');

const profileRow = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ITEM,
  organizationId: ORG,
  userId: ACTOR,
  isPublic: true,
  displayName: 'Rabin R',
  headline: null,
  location: null,
  email: null,
  phone: null,
  website: null,
  github: null,
  linkedin: null,
  twitter: null,
  avatarUrl: null,
  resumeUrl: null,
  heroGreeting: null,
  heroTitle: 'Builder',
  heroSubtitle: null,
  heroPrimaryCtaLabel: null,
  heroPrimaryCtaUrl: null,
  heroSecondaryCtaLabel: null,
  heroSecondaryCtaUrl: null,
  heroImageUrl: null,
  aboutBody: null,
  aboutImageUrl: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...extra,
});

const experienceRow = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ITEM,
  organizationId: ORG,
  userId: ACTOR,
  role: 'Engineer',
  company: 'Acme',
  location: null,
  startDate: new Date('2023-01-01T00:00:00Z'),
  endDate: new Date('2024-06-30T00:00:00Z'),
  isCurrent: false,
  description: null,
  sortOrder: 0,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...extra,
});

const skillRow = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: ITEM,
  organizationId: ORG,
  userId: ACTOR,
  name: 'TypeScript',
  category: 'Language',
  level: 90,
  sortOrder: 0,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...extra,
});

function makeRepo(
  overrides: Partial<Record<keyof PortfolioRepository, jest.Mock>> = {}
): Record<string, jest.Mock> {
  const repo = {
    findProfile: jest.fn().mockResolvedValue(null),
    upsertProfile: jest.fn().mockResolvedValue(profileRow()),
    findPublicProfile: jest.fn().mockResolvedValue(null),
    listSkills: jest.fn().mockResolvedValue([skillRow()]),
    findSkill: jest.fn().mockResolvedValue(skillRow()),
    createSkill: jest.fn().mockResolvedValue(skillRow()),
    updateSkill: jest.fn().mockResolvedValue(1),
    softDeleteSkill: jest.fn().mockResolvedValue(1),
    reorderSkills: jest.fn().mockResolvedValue(true),
    listExperiences: jest.fn().mockResolvedValue([]),
    findExperience: jest.fn().mockResolvedValue(experienceRow()),
    createExperience: jest.fn().mockResolvedValue(experienceRow()),
    updateExperience: jest.fn().mockResolvedValue(1),
    softDeleteExperience: jest.fn().mockResolvedValue(1),
    reorderExperiences: jest.fn().mockResolvedValue(true),
    listEducation: jest.fn().mockResolvedValue([]),
    findEducation: jest.fn(),
    createEducation: jest.fn(),
    updateEducation: jest.fn(),
    softDeleteEducation: jest.fn(),
    reorderEducation: jest.fn(),
    listServices: jest.fn().mockResolvedValue([]),
    findService: jest.fn(),
    createService: jest.fn(),
    updateService: jest.fn(),
    softDeleteService: jest.fn(),
    reorderServices: jest.fn(),
    listTestimonials: jest.fn().mockResolvedValue([]),
    findTestimonial: jest.fn(),
    createTestimonial: jest.fn(),
    updateTestimonial: jest.fn(),
    softDeleteTestimonial: jest.fn(),
    reorderTestimonials: jest.fn(),
    publicCollections: jest.fn().mockResolvedValue({
      skills: [],
      experiences: [],
      education: [],
      services: [],
      testimonials: [],
    }),
    ...overrides,
  };
  return repo;
}

const serviceWith = (repo: Record<string, jest.Mock>): PortfolioService =>
  new PortfolioService(repo as unknown as PortfolioRepository);

const expectAppError = async (
  promise: Promise<unknown>,
  code: string,
  status: number
): Promise<void> => {
  await expect(promise).rejects.toMatchObject({ code, status });
  await expect(promise).rejects.toBeInstanceOf(AppError);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PortfolioService: ownership', () => {
  it('scopes every read and write to the caller tenant and user', async () => {
    const repo = makeRepo();
    const service = serviceWith(repo);

    await service.listSkills(ctx);
    await service.updateSkill(ctx, ITEM, { name: 'Go' });

    const owner = { organizationId: ORG, userId: ACTOR };
    expect(repo.listSkills).toHaveBeenCalledWith(owner);
    expect(repo.updateSkill).toHaveBeenCalledWith(owner, ITEM, ACTOR, { name: 'Go' });
  });

  it('answers 404 for a malformed id without touching the database', async () => {
    const repo = makeRepo();
    const service = serviceWith(repo);

    await expectAppError(service.deleteSkill(ctx, 'not-a-uuid'), 'PORTFOLIO_ITEM_NOT_FOUND', 404);
    expect(repo.softDeleteSkill).not.toHaveBeenCalled();
  });

  it('answers 404 when the row is missing or owned by someone else', async () => {
    const repo = makeRepo({ updateSkill: jest.fn().mockResolvedValue(0) });
    const service = serviceWith(repo);

    await expectAppError(
      service.updateSkill(ctx, ITEM, { name: 'Go' }),
      'PORTFOLIO_ITEM_NOT_FOUND',
      404
    );
  });
});

describe('PortfolioService: singleton sections', () => {
  it('returns empty values before the first save', async () => {
    const service = serviceWith(makeRepo());

    await expect(service.getProfile(ctx)).resolves.toMatchObject({
      isPublic: false,
      displayName: null,
      updatedAt: null,
    });
  });

  it('audits only the field names that were sent, never their values', async () => {
    const repo = makeRepo({ upsertProfile: jest.fn().mockResolvedValue(profileRow()) });
    const service = serviceWith(repo);

    await service.updateHero(ctx, { title: 'Builder', greeting: undefined } as never);

    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'portfolio.hero.updated',
        metadata: { fields: ['heroTitle'] },
      })
    );
    expect(JSON.stringify((AuditService.log as jest.Mock).mock.calls[0][0])).not.toContain(
      'Builder'
    );
  });

  it('maps hero DTO keys onto the hero_* columns', async () => {
    const repo = makeRepo();
    await serviceWith(repo).updateHero(ctx, {
      primaryCtaLabel: 'Hire me',
      primaryCtaUrl: '/contact',
    });

    expect(repo.upsertProfile).toHaveBeenCalledWith(
      { organizationId: ORG, userId: ACTOR },
      ACTOR,
      expect.objectContaining({ heroPrimaryCtaLabel: 'Hire me', heroPrimaryCtaUrl: '/contact' })
    );
  });
});

describe('PortfolioService: collections', () => {
  it('refuses to create past the item limit', async () => {
    const repo = makeRepo({ createSkill: jest.fn().mockResolvedValue(null) });

    await expectAppError(
      serviceWith(repo).createSkill(ctx, { name: 'Go' }),
      'PORTFOLIO_LIMIT_REACHED',
      409
    );
    expect(repo.createSkill).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR,
      expect.anything(),
      PORTFOLIO_ITEM_LIMIT
    );
  });

  it('rejects a reorder that does not list every owned item exactly once', async () => {
    const repo = makeRepo({ reorderSkills: jest.fn().mockResolvedValue(false) });

    await expectAppError(
      serviceWith(repo).reorderSkills(ctx, { ids: [ITEM] }),
      'PORTFOLIO_REORDER_INVALID',
      400
    );
  });
});

describe('PortfolioService: date ranges', () => {
  it('rejects an end date before the start date on create', async () => {
    const repo = makeRepo();

    await expectAppError(
      serviceWith(repo).createExperience(ctx, {
        role: 'Engineer',
        company: 'Acme',
        startDate: '2024-05-01',
        endDate: '2024-04-30',
        isCurrent: false,
      }),
      'INVALID_DATE_RANGE',
      400
    );
    expect(repo.createExperience).not.toHaveBeenCalled();
  });

  it('rejects a current role that still has an end date', async () => {
    await expectAppError(
      serviceWith(makeRepo()).createExperience(ctx, {
        role: 'Engineer',
        company: 'Acme',
        startDate: '2024-05-01',
        endDate: '2024-06-01',
        isCurrent: true,
      }),
      'INVALID_DATE_RANGE',
      400
    );
  });

  it('validates a partial update against the stored end date', async () => {
    // Stored end is 2024-06-30; moving the start past it must fail even though the body lacks endDate.
    const repo = makeRepo();

    await expectAppError(
      serviceWith(repo).updateExperience(ctx, ITEM, { startDate: '2025-01-01' }),
      'INVALID_DATE_RANGE',
      400
    );
    expect(repo.updateExperience).not.toHaveBeenCalled();
  });

  it('allows a partial update that clears the end date when marking the role current', async () => {
    const repo = makeRepo({
      findExperience: jest
        .fn()
        .mockResolvedValueOnce(experienceRow())
        .mockResolvedValueOnce(experienceRow({ isCurrent: true, endDate: null })),
    });

    await serviceWith(repo).updateExperience(ctx, ITEM, { isCurrent: true, endDate: null });

    expect(repo.updateExperience).toHaveBeenCalledWith(
      { organizationId: ORG, userId: ACTOR },
      ITEM,
      ACTOR,
      expect.objectContaining({ isCurrent: true, endDate: null })
    );
  });
});

describe('PortfolioService: public read', () => {
  it('404s for an unpublished or unknown username', async () => {
    await expectAppError(
      serviceWith(makeRepo()).getPublicPortfolio('nobody'),
      'PORTFOLIO_NOT_FOUND',
      404
    );
  });

  it('returns every section for a published portfolio, scoped to its owner', async () => {
    const repo = makeRepo({ findPublicProfile: jest.fn().mockResolvedValue(profileRow()) });

    const result = await serviceWith(repo).getPublicPortfolio('rabin');

    expect(repo.publicCollections).toHaveBeenCalledWith({ organizationId: ORG, userId: ACTOR });
    expect(result).toMatchObject({
      username: 'rabin',
      profile: { displayName: 'Rabin R', isPublic: true },
      hero: { title: 'Builder' },
      skills: [],
      experiences: [],
    });
  });
});
