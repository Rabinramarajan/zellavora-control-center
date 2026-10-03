import { AppError } from '../../middleware/error';
import { AuditService } from '../../infrastructure/audit';
import type { OrgContext } from '../../middleware/org-context';
import { ThemeRepository } from './theme.repository';
import { DEFAULT_THEME, ThemeDto, toThemeDto } from './theme.mapper';
import { CreateThemeDto, ThemeListQueryDto, UpdateThemeDto } from './theme.dto';

const notFound = () => new AppError('Theme not found', 404, 'THEME_NOT_FOUND');

/**
 * Organization theme library. Each organization keeps any number of themes and at most
 * one active theme, which every member's app applies on sign-in.
 */
export class ThemeService {
  constructor(private readonly repo = new ThemeRepository()) {}

  async list(ctx: OrgContext, query: ThemeListQueryDto) {
    const { data, total } = await this.repo.list(ctx.organizationId, query);
    return {
      data: data.map(toThemeDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  /** The theme to apply for the caller's organization; never fails for a missing theme. */
  async active(organizationId: string): Promise<ThemeDto> {
    const theme = await this.repo.findActive(organizationId);
    return theme ? toThemeDto(theme) : DEFAULT_THEME;
  }

  async get(ctx: OrgContext, id: string): Promise<ThemeDto> {
    const theme = await this.repo.findById(ctx.organizationId, id);
    if (!theme) throw notFound();
    return toThemeDto(theme);
  }

  async create(ctx: OrgContext, dto: CreateThemeDto): Promise<ThemeDto> {
    await this.assertNameFree(ctx.organizationId, dto.name);
    const theme = await this.repo.create({
      organizationId: ctx.organizationId,
      name: dto.name,
      description: dto.description ?? null,
      primaryColor: dto.primaryColor,
      secondaryColor: dto.secondaryColor,
      accentColor: dto.accentColor,
      fontFamily: dto.fontFamily,
      borderRadius: dto.borderRadius,
      mode: dto.mode,
      logoUrl: dto.logoUrl ?? null,
      faviconUrl: dto.faviconUrl ?? null,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
    });
    await this.audit(ctx, 'theme.created', theme.id, { name: theme.name });
    return toThemeDto(theme);
  }

  async update(ctx: OrgContext, id: string, dto: UpdateThemeDto): Promise<ThemeDto> {
    const existing = await this.repo.findById(ctx.organizationId, id);
    if (!existing) throw notFound();
    if (dto.name && dto.name !== existing.name) {
      await this.assertNameFree(ctx.organizationId, dto.name, id);
    }
    const { version, ...fields } = dto;
    const changed = await this.repo.updateVersioned(id, version, {
      ...fields,
      updatedBy: ctx.actorId,
    });
    if (!changed) {
      throw new AppError(
        'This theme was changed by someone else. Reload it and try again.',
        409,
        'THEME_VERSION_CONFLICT'
      );
    }
    await this.audit(ctx, 'theme.updated', id, { name: dto.name ?? existing.name });
    return this.get(ctx, id);
  }

  /** Makes the theme the organization's active theme (and deactivates the previous one). */
  async activate(ctx: OrgContext, id: string): Promise<ThemeDto> {
    const theme = await this.repo.findById(ctx.organizationId, id);
    if (!theme) throw notFound();
    if (!theme.isDefault) {
      await this.repo.transaction(async (tx) => {
        await this.repo.clearActive(ctx.organizationId, tx);
        await tx.theme.update({
          where: { id },
          data: { isDefault: true, updatedBy: ctx.actorId },
        });
      });
      await this.audit(ctx, 'theme.activated', id, { name: theme.name });
    }
    return this.get(ctx, id);
  }

  async duplicate(ctx: OrgContext, id: string, name: string): Promise<ThemeDto> {
    const source = await this.repo.findById(ctx.organizationId, id);
    if (!source) throw notFound();
    return this.create(ctx, {
      name,
      description: source.description,
      primaryColor: source.primaryColor ?? DEFAULT_THEME.primaryColor,
      secondaryColor: source.secondaryColor ?? DEFAULT_THEME.secondaryColor,
      accentColor: source.accentColor ?? DEFAULT_THEME.accentColor,
      fontFamily: source.fontFamily as CreateThemeDto['fontFamily'],
      borderRadius: source.borderRadius,
      mode: source.mode === 'dark' ? 'dark' : 'light',
      logoUrl: source.logoUrl,
      faviconUrl: source.faviconUrl,
    });
  }

  async remove(ctx: OrgContext, id: string): Promise<{ success: true }> {
    const theme = await this.repo.findById(ctx.organizationId, id);
    if (!theme) throw notFound();
    if (theme.isDefault) {
      throw new AppError(
        'The active theme cannot be deleted. Activate another theme first.',
        409,
        'THEME_ACTIVE'
      );
    }
    await this.repo.softDelete(id, ctx.actorId);
    await this.audit(ctx, 'theme.deleted', id, { name: theme.name });
    return { success: true };
  }

  private async assertNameFree(organizationId: string, name: string, exceptId?: string) {
    const dup = await this.repo.findByName(organizationId, name);
    if (dup && dup.id !== exceptId) {
      throw new AppError(`A theme named '${name}' already exists`, 409, 'THEME_NAME_EXISTS');
    }
  }

  private audit(ctx: OrgContext, action: string, id: string, metadata: Record<string, unknown>) {
    return AuditService.log({
      action,
      resource: 'theme',
      resourceId: id,
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      severity: 'info',
      metadata,
    });
  }
}
