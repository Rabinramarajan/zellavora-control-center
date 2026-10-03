import { ThemeService } from './theme.service';
import { ThemeRepository } from './theme.repository';
import { CreateThemeSchema, SaveActiveThemeSchema, UpdateThemeSchema } from './theme.dto';
import { DEFAULT_THEME } from './theme.mapper';

jest.mock('../../infrastructure/audit', () => ({ AuditService: { log: jest.fn() } }));

const ORG = '00000000-0000-4000-8000-000000000900';
const ACTOR = '00000000-0000-4000-8000-000000000099';
const ctx = { organizationId: ORG, actorId: ACTOR };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const row = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n),
  organizationId: ORG,
  name: `Theme ${n}`,
  description: null,
  primaryColor: '#111111',
  secondaryColor: '#222222',
  accentColor: '#333333',
  backgroundColor: null,
  textColor: null,
  successColor: null,
  warningColor: null,
  errorColor: null,
  infoColor: null,
  surfaceColor: null,
  fontSize: 16,
  spacing: 4,
  fontFamily: 'Inter',
  borderRadius: 8,
  logoUrl: null,
  faviconUrl: null,
  mode: 'light',
  isDefault: false,
  isDeleted: false,
  deletedAt: null,
  createdBy: null,
  updatedBy: null,
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...extra,
});

function makeRepo(overrides: Partial<Record<keyof ThemeRepository, jest.Mock>> = {}) {
  const tx = { theme: { update: jest.fn() } };
  const repo = {
    findById: jest.fn().mockResolvedValue(row(1)),
    findActive: jest.fn().mockResolvedValue(null),
    findByName: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    create: jest.fn(async (data: Record<string, unknown>) => row(1, data)),
    updateVersioned: jest.fn().mockResolvedValue(1),
    clearActive: jest.fn(),
    softDelete: jest.fn(),
    transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    ...overrides,
  };
  return { repo: repo as unknown as ThemeRepository & typeof repo, tx };
}

const valid = {
  name: 'Brand',
  primaryColor: '#4f46e5',
  secondaryColor: '#8b5cf6',
  accentColor: '#0ea5e9',
  successColor: '#10b981',
  warningColor: '#f59e0b',
  errorColor: '#ef4444',
  infoColor: '#3b82f6',
  backgroundColor: '#0f172a',
  surfaceColor: '#1e293b',
  fontSize: 16,
  spacing: 4,
  fontFamily: 'Inter',
  borderRadius: 8,
  mode: 'light',
};

describe('theme DTOs', () => {
  it('normalises hex colours and rejects malformed ones', () => {
    expect(CreateThemeSchema.parse(valid).primaryColor).toBe('#4F46E5');
    expect(() => CreateThemeSchema.parse({ ...valid, primaryColor: 'blue' })).toThrow();
  });

  it('only accepts https asset URLs and known fonts', () => {
    expect(() => CreateThemeSchema.parse({ ...valid, logoUrl: 'http://x.io/a.png' })).toThrow();
    expect(() => CreateThemeSchema.parse({ ...valid, fontFamily: 'Comic Sans' })).toThrow();
    expect(() => UpdateThemeSchema.parse({ borderRadius: 30 })).toThrow();
  });
});

describe('ThemeService', () => {
  it('serves the built-in default when nothing is active', async () => {
    const { repo } = makeRepo();
    await expect(new ThemeService(repo).active(ORG)).resolves.toEqual(DEFAULT_THEME);
  });

  it('rejects a duplicate name in the same organization', async () => {
    const { repo } = makeRepo({ findByName: jest.fn().mockResolvedValue(row(2)) });
    await expect(
      new ThemeService(repo).create(ctx, CreateThemeSchema.parse(valid))
    ).rejects.toMatchObject({ status: 409 });
  });

  it('creates themes inside the caller organization', async () => {
    const { repo } = makeRepo();
    await new ThemeService(repo).create(ctx, CreateThemeSchema.parse(valid));
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, createdBy: ACTOR })
    );
  });

  it('reports a conflict when the theme changed since it was loaded', async () => {
    const { repo } = makeRepo({ updateVersioned: jest.fn().mockResolvedValue(0) });
    await expect(
      new ThemeService(repo).update(ctx, id(1), { borderRadius: 4, version: 1 })
    ).rejects.toMatchObject({ status: 409, code: 'THEME_VERSION_CONFLICT' });
  });

  it('activates by clearing the previous active theme first', async () => {
    const { repo, tx } = makeRepo();
    await new ThemeService(repo).activate(ctx, id(1));
    expect(repo.clearActive).toHaveBeenCalledWith(ORG, tx);
    expect(tx.theme.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: id(1) },
        data: expect.objectContaining({ isDefault: true }),
      })
    );
  });

  it('does nothing when activating the theme that is already active', async () => {
    const { repo } = makeRepo({
      findById: jest.fn().mockResolvedValue(row(1, { isDefault: true })),
    });
    await new ThemeService(repo).activate(ctx, id(1));
    expect(repo.clearActive).not.toHaveBeenCalled();
  });

  it('refuses to delete the active theme', async () => {
    const { repo } = makeRepo({
      findById: jest.fn().mockResolvedValue(row(1, { isDefault: true })),
    });
    await expect(new ThemeService(repo).remove(ctx, id(1))).rejects.toMatchObject({
      status: 409,
    });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });

  it('returns 404 for a theme from another organization', async () => {
    const { repo } = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    await expect(new ThemeService(repo).get(ctx, id(1))).rejects.toMatchObject({ status: 404 });
  });

  it('duplicates every visual setting under the new name', async () => {
    const { repo } = makeRepo();
    await new ThemeService(repo).duplicate(ctx, id(1), 'Copy');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Copy', primaryColor: '#111111', fontFamily: 'Inter' })
    );
  });

  it('saveActive updates the active theme when there is one', async () => {
    const { repo } = makeRepo({
      findActive: jest.fn().mockResolvedValue(row(1, { isDefault: true })),
    });
    await new ThemeService(repo).saveActive(ctx, SaveActiveThemeSchema.parse(valid));
    expect(repo.updateVersioned).toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('saveActive creates and activates the first theme', async () => {
    const { repo, tx } = makeRepo();
    await new ThemeService(repo).saveActive(ctx, SaveActiveThemeSchema.parse(valid));
    expect(repo.create).toHaveBeenCalled();
    expect(tx.theme.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) })
    );
  });

  it('limits the type and spacing scale', () => {
    expect(() => SaveActiveThemeSchema.parse({ ...valid, fontSize: 30 })).toThrow();
    expect(() => SaveActiveThemeSchema.parse({ ...valid, spacing: 1 })).toThrow();
  });
});
