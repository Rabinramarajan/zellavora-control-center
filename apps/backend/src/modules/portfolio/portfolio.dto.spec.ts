import {
  EducationCreateSchema,
  ExperienceCreateSchema,
  HeroUpdateSchema,
  PORTFOLIO_ITEM_LIMIT,
  ProfileUpdateSchema,
  ReorderSchema,
  ServiceCreateSchema,
  dateRangeError,
} from './portfolio.dto';

const ID = '00000000-0000-4000-8000-000000000042';

describe('portfolio input schemas', () => {
  it('rejects unknown keys so a client cannot set owner or audit columns', () => {
    const result = ProfileUpdateSchema.safeParse({ displayName: 'R', userId: ID });
    expect(result.success).toBe(false);
  });

  it('stores blank optional text as null', () => {
    const result = ProfileUpdateSchema.parse({ headline: '   ', location: '' });
    expect(result.headline).toBeNull();
    expect(result.location).toBeNull();
  });

  it('accepts only http(s) URLs for profile links', () => {
    expect(ProfileUpdateSchema.safeParse({ website: 'https://example.com' }).success).toBe(true);
    expect(ProfileUpdateSchema.safeParse({ website: 'javascript:alert(1)' }).success).toBe(false);
    expect(ProfileUpdateSchema.safeParse({ github: 'github.com/x' }).success).toBe(false);
  });

  it('allows hero CTAs to be https, mailto or in-app paths, but not protocol-relative URLs', () => {
    expect(HeroUpdateSchema.safeParse({ primaryCtaUrl: '/contact' }).success).toBe(true);
    expect(HeroUpdateSchema.safeParse({ primaryCtaUrl: 'mailto:hi@example.com' }).success).toBe(
      true
    );
    expect(HeroUpdateSchema.safeParse({ primaryCtaUrl: 'https://example.com/cv' }).success).toBe(
      true
    );
    expect(HeroUpdateSchema.safeParse({ primaryCtaUrl: '//evil.example' }).success).toBe(false);
    expect(HeroUpdateSchema.safeParse({ primaryCtaUrl: 'javascript:alert(1)' }).success).toBe(
      false
    );
  });

  it('rejects dates that do not exist or are not YYYY-MM-DD', () => {
    const base = { role: 'Engineer', company: 'Acme', startDate: '2026-01-10' };
    expect(ExperienceCreateSchema.safeParse(base).success).toBe(true);
    expect(ExperienceCreateSchema.safeParse({ ...base, startDate: '2026-02-30' }).success).toBe(
      false
    );
    expect(ExperienceCreateSchema.safeParse({ ...base, startDate: '2026/01/10' }).success).toBe(
      false
    );
  });

  it('requires the fields a section cannot exist without', () => {
    expect(
      EducationCreateSchema.safeParse({ institution: 'MIT', startDate: '2020-09-01' }).success
    ).toBe(false);
    expect(ServiceCreateSchema.safeParse({ description: 'No title' }).success).toBe(false);
  });

  it('lowercases icon keys and rejects anything that is not a key', () => {
    expect(ServiceCreateSchema.parse({ title: 'Design', icon: 'Brush-Tool' }).icon).toBe(
      'brush-tool'
    );
    expect(ServiceCreateSchema.safeParse({ title: 'Design', icon: '<svg>' }).success).toBe(false);
  });

  it('defaults a new experience to not current', () => {
    const parsed = ExperienceCreateSchema.parse({
      role: 'Engineer',
      company: 'Acme',
      startDate: '2026-01-10',
    });
    expect(parsed.isCurrent).toBe(false);
  });

  it('rejects reorder lists with duplicates, empties or more than the limit', () => {
    expect(ReorderSchema.safeParse({ ids: [ID, ID] }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    const tooMany = Array.from(
      { length: PORTFOLIO_ITEM_LIMIT + 1 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    );
    expect(ReorderSchema.safeParse({ ids: tooMany }).success).toBe(false);
    expect(ReorderSchema.safeParse({ ids: [ID] }).success).toBe(true);
  });
});

describe('dateRangeError', () => {
  it('allows an open-ended or same-day range', () => {
    expect(dateRangeError('2024-01-01', null)).toBeNull();
    expect(dateRangeError('2024-01-01', '2024-01-01')).toBeNull();
  });

  it('flags a reversed range and a current role with an end date', () => {
    expect(dateRangeError('2024-05-01', '2024-04-30')).toMatch(/on or after/);
    expect(dateRangeError('2024-05-01', '2024-06-01', true)).toMatch(/current/);
  });
});
