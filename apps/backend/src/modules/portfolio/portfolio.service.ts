import type {
  PortfolioEducation,
  PortfolioExperience,
  PortfolioProfile,
  PortfolioServiceItem,
  PortfolioSkill,
  PortfolioTestimonial,
} from '@prisma/client';
import { AppError } from '../../middleware/error';
import type { OrgContext } from '../../middleware/org-context';
import { AuditService } from '../../infrastructure/audit';
import {
  AboutUpdateDto,
  EducationCreateDto,
  EducationUpdateDto,
  ExperienceCreateDto,
  ExperienceUpdateDto,
  HeroUpdateDto,
  PORTFOLIO_ITEM_LIMIT,
  ProfileUpdateDto,
  ReorderDto,
  ServiceCreateDto,
  ServiceUpdateDto,
  SkillCreateDto,
  SkillUpdateDto,
  TestimonialCreateDto,
  TestimonialUpdateDto,
  dateRangeError,
  fromDateOnly,
  toDateOnly,
} from './portfolio.dto';
import { Owner, PortfolioRepository, ProfileFields, isUuid } from './portfolio.repository';

// ---------------------------------------------------------------------------
// Response shapes (camelCase, dates as YYYY-MM-DD or ISO timestamps)
// ---------------------------------------------------------------------------

export interface ProfileDto {
  isPublic: boolean;
  displayName: string | null;
  headline: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  github: string | null;
  linkedin: string | null;
  twitter: string | null;
  avatarUrl: string | null;
  resumeUrl: string | null;
  updatedAt: string | null;
}

export interface HeroDto {
  greeting: string | null;
  title: string | null;
  subtitle: string | null;
  primaryCtaLabel: string | null;
  primaryCtaUrl: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaUrl: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
}

export interface AboutDto {
  body: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
}

export interface SkillDto {
  id: string;
  name: string;
  category: string | null;
  level: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceDto {
  id: string;
  role: string;
  company: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EducationDto {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  grade: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceDto {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestimonialDto {
  id: string;
  authorName: string;
  authorRole: string | null;
  company: string | null;
  quote: string;
  avatarUrl: string | null;
  rating: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPortfolioDto {
  username: string;
  profile: ProfileDto;
  hero: HeroDto;
  about: AboutDto;
  skills: SkillDto[];
  experiences: ExperienceDto[];
  education: EducationDto[];
  services: ServiceDto[];
  testimonials: TestimonialDto[];
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const stamp = (date: Date): string => date.toISOString();

export const toProfileDto = (row: PortfolioProfile | null): ProfileDto => ({
  isPublic: row?.isPublic ?? false,
  displayName: row?.displayName ?? null,
  headline: row?.headline ?? null,
  location: row?.location ?? null,
  email: row?.email ?? null,
  phone: row?.phone ?? null,
  website: row?.website ?? null,
  github: row?.github ?? null,
  linkedin: row?.linkedin ?? null,
  twitter: row?.twitter ?? null,
  avatarUrl: row?.avatarUrl ?? null,
  resumeUrl: row?.resumeUrl ?? null,
  updatedAt: row ? stamp(row.updatedAt) : null,
});

export const toHeroDto = (row: PortfolioProfile | null): HeroDto => ({
  greeting: row?.heroGreeting ?? null,
  title: row?.heroTitle ?? null,
  subtitle: row?.heroSubtitle ?? null,
  primaryCtaLabel: row?.heroPrimaryCtaLabel ?? null,
  primaryCtaUrl: row?.heroPrimaryCtaUrl ?? null,
  secondaryCtaLabel: row?.heroSecondaryCtaLabel ?? null,
  secondaryCtaUrl: row?.heroSecondaryCtaUrl ?? null,
  imageUrl: row?.heroImageUrl ?? null,
  updatedAt: row ? stamp(row.updatedAt) : null,
});

export const toAboutDto = (row: PortfolioProfile | null): AboutDto => ({
  body: row?.aboutBody ?? null,
  imageUrl: row?.aboutImageUrl ?? null,
  updatedAt: row ? stamp(row.updatedAt) : null,
});

export const toSkillDto = (row: PortfolioSkill): SkillDto => ({
  id: row.id,
  name: row.name,
  category: row.category,
  level: row.level,
  sortOrder: row.sortOrder,
  createdAt: stamp(row.createdAt),
  updatedAt: stamp(row.updatedAt),
});

export const toExperienceDto = (row: PortfolioExperience): ExperienceDto => ({
  id: row.id,
  role: row.role,
  company: row.company,
  location: row.location,
  startDate: fromDateOnly(row.startDate),
  endDate: row.endDate ? fromDateOnly(row.endDate) : null,
  isCurrent: row.isCurrent,
  description: row.description,
  sortOrder: row.sortOrder,
  createdAt: stamp(row.createdAt),
  updatedAt: stamp(row.updatedAt),
});

export const toEducationDto = (row: PortfolioEducation): EducationDto => ({
  id: row.id,
  institution: row.institution,
  degree: row.degree,
  field: row.field,
  grade: row.grade,
  startDate: fromDateOnly(row.startDate),
  endDate: row.endDate ? fromDateOnly(row.endDate) : null,
  description: row.description,
  sortOrder: row.sortOrder,
  createdAt: stamp(row.createdAt),
  updatedAt: stamp(row.updatedAt),
});

export const toServiceDto = (row: PortfolioServiceItem): ServiceDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  icon: row.icon,
  sortOrder: row.sortOrder,
  createdAt: stamp(row.createdAt),
  updatedAt: stamp(row.updatedAt),
});

export const toTestimonialDto = (row: PortfolioTestimonial): TestimonialDto => ({
  id: row.id,
  authorName: row.authorName,
  authorRole: row.authorRole,
  company: row.company,
  quote: row.quote,
  avatarUrl: row.avatarUrl,
  rating: row.rating,
  sortOrder: row.sortOrder,
  createdAt: stamp(row.createdAt),
  updatedAt: stamp(row.updatedAt),
});

// ---------------------------------------------------------------------------
// Input mapping: DTO keys to column names
// ---------------------------------------------------------------------------

const toHeroFields = (dto: HeroUpdateDto): ProfileFields => ({
  heroGreeting: dto.greeting,
  heroTitle: dto.title,
  heroSubtitle: dto.subtitle,
  heroPrimaryCtaLabel: dto.primaryCtaLabel,
  heroPrimaryCtaUrl: dto.primaryCtaUrl,
  heroSecondaryCtaLabel: dto.secondaryCtaLabel,
  heroSecondaryCtaUrl: dto.secondaryCtaUrl,
  heroImageUrl: dto.imageUrl,
});

const toAboutFields = (dto: AboutUpdateDto): ProfileFields => ({
  aboutBody: dto.body,
  aboutImageUrl: dto.imageUrl,
});

/** `undefined` leaves the column alone on update; `null` clears it. */
const dateColumn = (value: string | null | undefined): Date | null | undefined =>
  value === undefined ? undefined : value === null ? null : toDateOnly(value);

const notFound = (label: string): AppError =>
  new AppError(`${label} not found`, 404, 'PORTFOLIO_ITEM_NOT_FOUND');

const limitReached = (label: string): AppError =>
  new AppError(
    `You can add up to ${PORTFOLIO_ITEM_LIMIT} ${label}`,
    409,
    'PORTFOLIO_LIMIT_REACHED'
  );

const invalidReorder = (): AppError =>
  new AppError(
    'The order must list each of your items exactly once',
    400,
    'PORTFOLIO_REORDER_INVALID'
  );

const assertDateRange = (startDate: string, endDate: string | null, isCurrent: boolean): void => {
  const message = dateRangeError(startDate, endDate, isCurrent);
  if (message) {
    throw new AppError('Invalid dates', 400, 'INVALID_DATE_RANGE', {
      fields: { endDate: message },
    });
  }
};

const assertId = (id: string, label: string): void => {
  if (!isUuid(id)) throw notFound(label);
};

const ownerOf = (ctx: OrgContext): Owner => ({
  organizationId: ctx.organizationId,
  userId: ctx.actorId,
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Portfolio for the signed-in user. Every write is scoped to (tenant, user), so
 * a request can only ever touch its own rows. Unknown and foreign ids both 404.
 */
export class PortfolioService {
  public constructor(private readonly repo = new PortfolioRepository()) {}

  // ---- Profile, Hero and About (one row) -----------------------------------

  public async getProfile(ctx: OrgContext): Promise<ProfileDto> {
    return toProfileDto(await this.repo.findProfile(ownerOf(ctx)));
  }

  public async updateProfile(ctx: OrgContext, dto: ProfileUpdateDto): Promise<ProfileDto> {
    const row = await this.saveProfile(ctx, 'profile', dto);
    return toProfileDto(row);
  }

  public async getHero(ctx: OrgContext): Promise<HeroDto> {
    return toHeroDto(await this.repo.findProfile(ownerOf(ctx)));
  }

  public async updateHero(ctx: OrgContext, dto: HeroUpdateDto): Promise<HeroDto> {
    const row = await this.saveProfile(ctx, 'hero', toHeroFields(dto));
    return toHeroDto(row);
  }

  public async getAbout(ctx: OrgContext): Promise<AboutDto> {
    return toAboutDto(await this.repo.findProfile(ownerOf(ctx)));
  }

  public async updateAbout(ctx: OrgContext, dto: AboutUpdateDto): Promise<AboutDto> {
    const row = await this.saveProfile(ctx, 'about', toAboutFields(dto));
    return toAboutDto(row);
  }

  private async saveProfile(
    ctx: OrgContext,
    section: 'profile' | 'hero' | 'about',
    fields: ProfileFields | ProfileUpdateDto
  ): Promise<PortfolioProfile> {
    const row = await this.repo.upsertProfile(ownerOf(ctx), ctx.actorId, fields);
    await this.audit(ctx, `portfolio.${section}.updated`, row.id, {
      fields: Object.keys(fields).filter((key) => fields[key as keyof typeof fields] !== undefined),
    });
    return row;
  }

  // ---- Skills ----------------------------------------------------------------

  public async listSkills(ctx: OrgContext): Promise<SkillDto[]> {
    return (await this.repo.listSkills(ownerOf(ctx))).map(toSkillDto);
  }

  public async createSkill(ctx: OrgContext, dto: SkillCreateDto): Promise<SkillDto> {
    const row = await this.repo.createSkill(
      ownerOf(ctx),
      ctx.actorId,
      { name: dto.name, category: dto.category, level: dto.level },
      PORTFOLIO_ITEM_LIMIT
    );
    if (!row) throw limitReached('skills');
    await this.audit(ctx, 'portfolio.skill.created', row.id, { name: row.name });
    return toSkillDto(row);
  }

  public async updateSkill(ctx: OrgContext, id: string, dto: SkillUpdateDto): Promise<SkillDto> {
    assertId(id, 'Skill');
    const owner = ownerOf(ctx);
    const changed = await this.repo.updateSkill(owner, id, ctx.actorId, dto);
    if (changed === 0) throw notFound('Skill');
    const row = await this.repo.findSkill(owner, id);
    if (!row) throw notFound('Skill');
    await this.audit(ctx, 'portfolio.skill.updated', id, { fields: Object.keys(dto) });
    return toSkillDto(row);
  }

  public async deleteSkill(ctx: OrgContext, id: string): Promise<void> {
    assertId(id, 'Skill');
    const changed = await this.repo.softDeleteSkill(ownerOf(ctx), id, ctx.actorId);
    if (changed === 0) throw notFound('Skill');
    await this.audit(ctx, 'portfolio.skill.deleted', id);
  }

  public async reorderSkills(ctx: OrgContext, dto: ReorderDto): Promise<SkillDto[]> {
    const owner = ownerOf(ctx);
    if (!(await this.repo.reorderSkills(owner, ctx.actorId, dto.ids))) throw invalidReorder();
    await this.audit(ctx, 'portfolio.skill.reordered', null, { count: dto.ids.length });
    return this.listSkills(ctx);
  }

  // ---- Experience --------------------------------------------------------------

  public async listExperiences(ctx: OrgContext): Promise<ExperienceDto[]> {
    return (await this.repo.listExperiences(ownerOf(ctx))).map(toExperienceDto);
  }

  public async createExperience(ctx: OrgContext, dto: ExperienceCreateDto): Promise<ExperienceDto> {
    assertDateRange(dto.startDate, dto.endDate ?? null, dto.isCurrent);
    const row = await this.repo.createExperience(
      ownerOf(ctx),
      ctx.actorId,
      {
        role: dto.role,
        company: dto.company,
        location: dto.location,
        startDate: toDateOnly(dto.startDate),
        endDate: dateColumn(dto.endDate ?? null),
        isCurrent: dto.isCurrent,
        description: dto.description,
      },
      PORTFOLIO_ITEM_LIMIT
    );
    if (!row) throw limitReached('experiences');
    await this.audit(ctx, 'portfolio.experience.created', row.id, { role: row.role });
    return toExperienceDto(row);
  }

  public async updateExperience(
    ctx: OrgContext,
    id: string,
    dto: ExperienceUpdateDto
  ): Promise<ExperienceDto> {
    assertId(id, 'Experience');
    const owner = ownerOf(ctx);
    const existing = await this.repo.findExperience(owner, id);
    if (!existing) throw notFound('Experience');

    // Validate the merged dates: a partial update can change only one side of the range.
    assertDateRange(
      dto.startDate ?? fromDateOnly(existing.startDate),
      dto.endDate !== undefined
        ? dto.endDate
        : existing.endDate
          ? fromDateOnly(existing.endDate)
          : null,
      dto.isCurrent ?? existing.isCurrent
    );

    const changed = await this.repo.updateExperience(owner, id, ctx.actorId, {
      role: dto.role,
      company: dto.company,
      location: dto.location,
      startDate: dateColumn(dto.startDate),
      endDate: dateColumn(dto.endDate),
      isCurrent: dto.isCurrent,
      description: dto.description,
    });
    if (changed === 0) throw notFound('Experience');
    await this.audit(ctx, 'portfolio.experience.updated', id, { fields: Object.keys(dto) });
    const row = await this.repo.findExperience(owner, id);
    if (!row) throw notFound('Experience');
    return toExperienceDto(row);
  }

  public async deleteExperience(ctx: OrgContext, id: string): Promise<void> {
    assertId(id, 'Experience');
    const changed = await this.repo.softDeleteExperience(ownerOf(ctx), id, ctx.actorId);
    if (changed === 0) throw notFound('Experience');
    await this.audit(ctx, 'portfolio.experience.deleted', id);
  }

  public async reorderExperiences(ctx: OrgContext, dto: ReorderDto): Promise<ExperienceDto[]> {
    if (!(await this.repo.reorderExperiences(ownerOf(ctx), ctx.actorId, dto.ids))) {
      throw invalidReorder();
    }
    await this.audit(ctx, 'portfolio.experience.reordered', null, { count: dto.ids.length });
    return this.listExperiences(ctx);
  }

  // ---- Education ---------------------------------------------------------------

  public async listEducation(ctx: OrgContext): Promise<EducationDto[]> {
    return (await this.repo.listEducation(ownerOf(ctx))).map(toEducationDto);
  }

  public async createEducation(ctx: OrgContext, dto: EducationCreateDto): Promise<EducationDto> {
    assertDateRange(dto.startDate, dto.endDate ?? null, false);
    const row = await this.repo.createEducation(
      ownerOf(ctx),
      ctx.actorId,
      {
        institution: dto.institution,
        degree: dto.degree,
        field: dto.field,
        grade: dto.grade,
        startDate: toDateOnly(dto.startDate),
        endDate: dateColumn(dto.endDate ?? null),
        description: dto.description,
      },
      PORTFOLIO_ITEM_LIMIT
    );
    if (!row) throw limitReached('education entries');
    await this.audit(ctx, 'portfolio.education.created', row.id, { degree: row.degree });
    return toEducationDto(row);
  }

  public async updateEducation(
    ctx: OrgContext,
    id: string,
    dto: EducationUpdateDto
  ): Promise<EducationDto> {
    assertId(id, 'Education');
    const owner = ownerOf(ctx);
    const existing = await this.repo.findEducation(owner, id);
    if (!existing) throw notFound('Education');

    assertDateRange(
      dto.startDate ?? fromDateOnly(existing.startDate),
      dto.endDate !== undefined
        ? dto.endDate
        : existing.endDate
          ? fromDateOnly(existing.endDate)
          : null,
      false
    );

    const changed = await this.repo.updateEducation(owner, id, ctx.actorId, {
      institution: dto.institution,
      degree: dto.degree,
      field: dto.field,
      grade: dto.grade,
      startDate: dateColumn(dto.startDate),
      endDate: dateColumn(dto.endDate),
      description: dto.description,
    });
    if (changed === 0) throw notFound('Education');
    await this.audit(ctx, 'portfolio.education.updated', id, { fields: Object.keys(dto) });
    const row = await this.repo.findEducation(owner, id);
    if (!row) throw notFound('Education');
    return toEducationDto(row);
  }

  public async deleteEducation(ctx: OrgContext, id: string): Promise<void> {
    assertId(id, 'Education');
    const changed = await this.repo.softDeleteEducation(ownerOf(ctx), id, ctx.actorId);
    if (changed === 0) throw notFound('Education');
    await this.audit(ctx, 'portfolio.education.deleted', id);
  }

  public async reorderEducation(ctx: OrgContext, dto: ReorderDto): Promise<EducationDto[]> {
    if (!(await this.repo.reorderEducation(ownerOf(ctx), ctx.actorId, dto.ids))) {
      throw invalidReorder();
    }
    await this.audit(ctx, 'portfolio.education.reordered', null, { count: dto.ids.length });
    return this.listEducation(ctx);
  }

  // ---- Services ------------------------------------------------------------------

  public async listServices(ctx: OrgContext): Promise<ServiceDto[]> {
    return (await this.repo.listServices(ownerOf(ctx))).map(toServiceDto);
  }

  public async createService(ctx: OrgContext, dto: ServiceCreateDto): Promise<ServiceDto> {
    const row = await this.repo.createService(
      ownerOf(ctx),
      ctx.actorId,
      { title: dto.title, description: dto.description, icon: dto.icon },
      PORTFOLIO_ITEM_LIMIT
    );
    if (!row) throw limitReached('services');
    await this.audit(ctx, 'portfolio.service.created', row.id, { title: row.title });
    return toServiceDto(row);
  }

  public async updateService(
    ctx: OrgContext,
    id: string,
    dto: ServiceUpdateDto
  ): Promise<ServiceDto> {
    assertId(id, 'Service');
    const owner = ownerOf(ctx);
    const changed = await this.repo.updateService(owner, id, ctx.actorId, dto);
    if (changed === 0) throw notFound('Service');
    const row = await this.repo.findService(owner, id);
    if (!row) throw notFound('Service');
    await this.audit(ctx, 'portfolio.service.updated', id, { fields: Object.keys(dto) });
    return toServiceDto(row);
  }

  public async deleteService(ctx: OrgContext, id: string): Promise<void> {
    assertId(id, 'Service');
    const changed = await this.repo.softDeleteService(ownerOf(ctx), id, ctx.actorId);
    if (changed === 0) throw notFound('Service');
    await this.audit(ctx, 'portfolio.service.deleted', id);
  }

  public async reorderServices(ctx: OrgContext, dto: ReorderDto): Promise<ServiceDto[]> {
    if (!(await this.repo.reorderServices(ownerOf(ctx), ctx.actorId, dto.ids))) {
      throw invalidReorder();
    }
    await this.audit(ctx, 'portfolio.service.reordered', null, { count: dto.ids.length });
    return this.listServices(ctx);
  }

  // ---- Testimonials --------------------------------------------------------------

  public async listTestimonials(ctx: OrgContext): Promise<TestimonialDto[]> {
    return (await this.repo.listTestimonials(ownerOf(ctx))).map(toTestimonialDto);
  }

  public async createTestimonial(
    ctx: OrgContext,
    dto: TestimonialCreateDto
  ): Promise<TestimonialDto> {
    const row = await this.repo.createTestimonial(
      ownerOf(ctx),
      ctx.actorId,
      {
        authorName: dto.authorName,
        authorRole: dto.authorRole,
        company: dto.company,
        quote: dto.quote,
        avatarUrl: dto.avatarUrl,
        rating: dto.rating,
      },
      PORTFOLIO_ITEM_LIMIT
    );
    if (!row) throw limitReached('testimonials');
    await this.audit(ctx, 'portfolio.testimonial.created', row.id, { authorName: row.authorName });
    return toTestimonialDto(row);
  }

  public async updateTestimonial(
    ctx: OrgContext,
    id: string,
    dto: TestimonialUpdateDto
  ): Promise<TestimonialDto> {
    assertId(id, 'Testimonial');
    const owner = ownerOf(ctx);
    const changed = await this.repo.updateTestimonial(owner, id, ctx.actorId, dto);
    if (changed === 0) throw notFound('Testimonial');
    const row = await this.repo.findTestimonial(owner, id);
    if (!row) throw notFound('Testimonial');
    await this.audit(ctx, 'portfolio.testimonial.updated', id, { fields: Object.keys(dto) });
    return toTestimonialDto(row);
  }

  public async deleteTestimonial(ctx: OrgContext, id: string): Promise<void> {
    assertId(id, 'Testimonial');
    const changed = await this.repo.softDeleteTestimonial(ownerOf(ctx), id, ctx.actorId);
    if (changed === 0) throw notFound('Testimonial');
    await this.audit(ctx, 'portfolio.testimonial.deleted', id);
  }

  public async reorderTestimonials(ctx: OrgContext, dto: ReorderDto): Promise<TestimonialDto[]> {
    if (!(await this.repo.reorderTestimonials(ownerOf(ctx), ctx.actorId, dto.ids))) {
      throw invalidReorder();
    }
    await this.audit(ctx, 'portfolio.testimonial.reordered', null, { count: dto.ids.length });
    return this.listTestimonials(ctx);
  }

  // ---- Public read -----------------------------------------------------------------

  /** Anonymous read of a published portfolio. Unpublished or unknown usernames both 404. */
  public async getPublicPortfolio(username: string): Promise<PublicPortfolioDto> {
    const profile = await this.repo.findPublicProfile(username);
    if (!profile) throw new AppError('Portfolio not found', 404, 'PORTFOLIO_NOT_FOUND');

    const collections = await this.repo.publicCollections({
      organizationId: profile.organizationId,
      userId: profile.userId,
    });
    return {
      username,
      profile: toProfileDto(profile),
      hero: toHeroDto(profile),
      about: toAboutDto(profile),
      skills: collections.skills.map(toSkillDto),
      experiences: collections.experiences.map(toExperienceDto),
      education: collections.education.map(toEducationDto),
      services: collections.services.map(toServiceDto),
      testimonials: collections.testimonials.map(toTestimonialDto),
    };
  }

  // ---- Audit -------------------------------------------------------------------------

  /** Records field names only; values can contain personal contact details. */
  private audit(
    ctx: OrgContext,
    action: string,
    resourceId: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return AuditService.log({
      action,
      resource: 'portfolio',
      resourceId,
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      metadata,
    });
  }
}
