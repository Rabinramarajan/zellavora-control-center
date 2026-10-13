import type {
  Prisma,
  PortfolioEducation,
  PortfolioExperience,
  PortfolioProfile,
  PortfolioServiceItem,
  PortfolioSkill,
  PortfolioTestimonial,
} from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';

/** Every portfolio row belongs to one user inside one tenant; both are required on every query. */
export interface Owner {
  organizationId: string;
  userId: string;
}

/** Create payload without the columns the repository fills in (ids, owner, ordering, audit stamps). */
export type OwnedCreate<T> = Omit<
  T,
  | 'id'
  | 'organizationId'
  | 'userId'
  | 'sortOrder'
  | 'deletedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'createdAt'
  | 'updatedAt'
>;

export type ProfileFields = Partial<
  Omit<
    Prisma.PortfolioProfileUncheckedCreateInput,
    'id' | 'organizationId' | 'userId' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt'
  >
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string): boolean => UUID.test(value);

interface LiveWhere {
  organizationId: string;
  userId: string;
  deletedAt: null;
}

const live = (owner: Owner): LiveWhere => ({
  organizationId: owner.organizationId,
  userId: owner.userId,
  deletedAt: null,
});

/** True when `ids` names exactly the live rows given, each once: a partial list would drop the rest from the order. */
export const sameIdSet = (liveIds: string[], ids: string[]): boolean =>
  liveIds.length === ids.length && ids.every((id) => liveIds.includes(id));

const manualOrder = [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }];

export class PortfolioRepository extends BaseRepository {
  // ---------------------------------------------------------------------------
  // Singleton profile (Profile, Hero and About sections share one row)
  // ---------------------------------------------------------------------------

  public findProfile(owner: Owner, tx?: TxClient): Promise<PortfolioProfile | null> {
    return this.getDb(tx).portfolioProfile.findUnique({
      where: {
        organizationId_userId: { organizationId: owner.organizationId, userId: owner.userId },
      },
    });
  }

  public upsertProfile(
    owner: Owner,
    actorId: string,
    fields: ProfileFields
  ): Promise<PortfolioProfile> {
    const key = {
      organizationId_userId: { organizationId: owner.organizationId, userId: owner.userId },
    };
    return this.getDb().portfolioProfile.upsert({
      where: key,
      create: {
        organizationId: owner.organizationId,
        userId: owner.userId,
        createdBy: actorId,
        updatedBy: actorId,
        ...fields,
      },
      update: { ...fields, updatedBy: actorId },
    });
  }

  /** The public page resolves the newest public profile for a username. */
  public findPublicProfile(username: string): Promise<PortfolioProfile | null> {
    return this.getDb().portfolioProfile.findFirst({
      where: { isPublic: true, user: { username } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Skills
  // ---------------------------------------------------------------------------

  public listSkills(owner: Owner, tx?: TxClient): Promise<PortfolioSkill[]> {
    return this.getDb(tx).portfolioSkill.findMany({ where: live(owner), orderBy: manualOrder });
  }

  public findSkill(owner: Owner, id: string): Promise<PortfolioSkill | null> {
    return this.getDb().portfolioSkill.findFirst({ where: { ...live(owner), id } });
  }

  /** Appends at the end. Resolves null when the section is already at the item limit. */
  public createSkill(
    owner: Owner,
    actorId: string,
    data: OwnedCreate<Prisma.PortfolioSkillUncheckedCreateInput>,
    limit: number
  ): Promise<PortfolioSkill | null> {
    return this.withTransaction(async (tx) => {
      const count = await tx.portfolioSkill.count({ where: live(owner) });
      if (count >= limit) return null;
      const last = await tx.portfolioSkill.findFirst({
        where: live(owner),
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      return tx.portfolioSkill.create({
        data: {
          ...data,
          organizationId: owner.organizationId,
          userId: owner.userId,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
    });
  }

  /** Resolves the number of rows changed, so 0 means the row is missing or not owned. */
  public async updateSkill(
    owner: Owner,
    id: string,
    actorId: string,
    data: Prisma.PortfolioSkillUncheckedUpdateInput
  ): Promise<number> {
    const res = await this.getDb().portfolioSkill.updateMany({
      where: { ...live(owner), id },
      data: { ...data, updatedBy: actorId },
    });
    return res.count;
  }

  public async softDeleteSkill(owner: Owner, id: string, actorId: string): Promise<number> {
    const res = await this.getDb().portfolioSkill.updateMany({
      where: { ...live(owner), id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return res.count;
  }

  /** Writes 0..n-1 in the given order. Resolves false unless every id is a live row the owner holds. */
  public reorderSkills(owner: Owner, actorId: string, ids: string[]): Promise<boolean> {
    return this.withTransaction(async (tx) => {
      const rows = await tx.portfolioSkill.findMany({ where: live(owner), select: { id: true } });
      if (
        !sameIdSet(
          rows.map((row) => row.id),
          ids
        )
      )
        return false;
      for (const [index, id] of ids.entries()) {
        await tx.portfolioSkill.updateMany({
          where: { ...live(owner), id },
          data: { sortOrder: index, updatedBy: actorId },
        });
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Experience
  // ---------------------------------------------------------------------------

  public listExperiences(owner: Owner, tx?: TxClient): Promise<PortfolioExperience[]> {
    return this.getDb(tx).portfolioExperience.findMany({
      where: live(owner),
      orderBy: manualOrder,
    });
  }

  public findExperience(owner: Owner, id: string): Promise<PortfolioExperience | null> {
    return this.getDb().portfolioExperience.findFirst({ where: { ...live(owner), id } });
  }

  public createExperience(
    owner: Owner,
    actorId: string,
    data: OwnedCreate<Prisma.PortfolioExperienceUncheckedCreateInput>,
    limit: number
  ): Promise<PortfolioExperience | null> {
    return this.withTransaction(async (tx) => {
      const count = await tx.portfolioExperience.count({ where: live(owner) });
      if (count >= limit) return null;
      const last = await tx.portfolioExperience.findFirst({
        where: live(owner),
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      return tx.portfolioExperience.create({
        data: {
          ...data,
          organizationId: owner.organizationId,
          userId: owner.userId,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
    });
  }

  public async updateExperience(
    owner: Owner,
    id: string,
    actorId: string,
    data: Prisma.PortfolioExperienceUncheckedUpdateInput
  ): Promise<number> {
    const res = await this.getDb().portfolioExperience.updateMany({
      where: { ...live(owner), id },
      data: { ...data, updatedBy: actorId },
    });
    return res.count;
  }

  public async softDeleteExperience(owner: Owner, id: string, actorId: string): Promise<number> {
    const res = await this.getDb().portfolioExperience.updateMany({
      where: { ...live(owner), id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return res.count;
  }

  public reorderExperiences(owner: Owner, actorId: string, ids: string[]): Promise<boolean> {
    return this.withTransaction(async (tx) => {
      const rows = await tx.portfolioExperience.findMany({
        where: live(owner),
        select: { id: true },
      });
      if (
        !sameIdSet(
          rows.map((row) => row.id),
          ids
        )
      )
        return false;
      for (const [index, id] of ids.entries()) {
        await tx.portfolioExperience.updateMany({
          where: { ...live(owner), id },
          data: { sortOrder: index, updatedBy: actorId },
        });
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Education
  // ---------------------------------------------------------------------------

  public listEducation(owner: Owner, tx?: TxClient): Promise<PortfolioEducation[]> {
    return this.getDb(tx).portfolioEducation.findMany({ where: live(owner), orderBy: manualOrder });
  }

  public findEducation(owner: Owner, id: string): Promise<PortfolioEducation | null> {
    return this.getDb().portfolioEducation.findFirst({ where: { ...live(owner), id } });
  }

  public createEducation(
    owner: Owner,
    actorId: string,
    data: OwnedCreate<Prisma.PortfolioEducationUncheckedCreateInput>,
    limit: number
  ): Promise<PortfolioEducation | null> {
    return this.withTransaction(async (tx) => {
      const count = await tx.portfolioEducation.count({ where: live(owner) });
      if (count >= limit) return null;
      const last = await tx.portfolioEducation.findFirst({
        where: live(owner),
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      return tx.portfolioEducation.create({
        data: {
          ...data,
          organizationId: owner.organizationId,
          userId: owner.userId,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
    });
  }

  public async updateEducation(
    owner: Owner,
    id: string,
    actorId: string,
    data: Prisma.PortfolioEducationUncheckedUpdateInput
  ): Promise<number> {
    const res = await this.getDb().portfolioEducation.updateMany({
      where: { ...live(owner), id },
      data: { ...data, updatedBy: actorId },
    });
    return res.count;
  }

  public async softDeleteEducation(owner: Owner, id: string, actorId: string): Promise<number> {
    const res = await this.getDb().portfolioEducation.updateMany({
      where: { ...live(owner), id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return res.count;
  }

  public reorderEducation(owner: Owner, actorId: string, ids: string[]): Promise<boolean> {
    return this.withTransaction(async (tx) => {
      const rows = await tx.portfolioEducation.findMany({
        where: live(owner),
        select: { id: true },
      });
      if (
        !sameIdSet(
          rows.map((row) => row.id),
          ids
        )
      )
        return false;
      for (const [index, id] of ids.entries()) {
        await tx.portfolioEducation.updateMany({
          where: { ...live(owner), id },
          data: { sortOrder: index, updatedBy: actorId },
        });
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  public listServices(owner: Owner, tx?: TxClient): Promise<PortfolioServiceItem[]> {
    return this.getDb(tx).portfolioServiceItem.findMany({
      where: live(owner),
      orderBy: manualOrder,
    });
  }

  public findService(owner: Owner, id: string): Promise<PortfolioServiceItem | null> {
    return this.getDb().portfolioServiceItem.findFirst({ where: { ...live(owner), id } });
  }

  public createService(
    owner: Owner,
    actorId: string,
    data: OwnedCreate<Prisma.PortfolioServiceItemUncheckedCreateInput>,
    limit: number
  ): Promise<PortfolioServiceItem | null> {
    return this.withTransaction(async (tx) => {
      const count = await tx.portfolioServiceItem.count({ where: live(owner) });
      if (count >= limit) return null;
      const last = await tx.portfolioServiceItem.findFirst({
        where: live(owner),
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      return tx.portfolioServiceItem.create({
        data: {
          ...data,
          organizationId: owner.organizationId,
          userId: owner.userId,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
    });
  }

  public async updateService(
    owner: Owner,
    id: string,
    actorId: string,
    data: Prisma.PortfolioServiceItemUncheckedUpdateInput
  ): Promise<number> {
    const res = await this.getDb().portfolioServiceItem.updateMany({
      where: { ...live(owner), id },
      data: { ...data, updatedBy: actorId },
    });
    return res.count;
  }

  public async softDeleteService(owner: Owner, id: string, actorId: string): Promise<number> {
    const res = await this.getDb().portfolioServiceItem.updateMany({
      where: { ...live(owner), id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return res.count;
  }

  public reorderServices(owner: Owner, actorId: string, ids: string[]): Promise<boolean> {
    return this.withTransaction(async (tx) => {
      const rows = await tx.portfolioServiceItem.findMany({
        where: live(owner),
        select: { id: true },
      });
      if (
        !sameIdSet(
          rows.map((row) => row.id),
          ids
        )
      )
        return false;
      for (const [index, id] of ids.entries()) {
        await tx.portfolioServiceItem.updateMany({
          where: { ...live(owner), id },
          data: { sortOrder: index, updatedBy: actorId },
        });
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Testimonials
  // ---------------------------------------------------------------------------

  public listTestimonials(owner: Owner, tx?: TxClient): Promise<PortfolioTestimonial[]> {
    return this.getDb(tx).portfolioTestimonial.findMany({
      where: live(owner),
      orderBy: manualOrder,
    });
  }

  public findTestimonial(owner: Owner, id: string): Promise<PortfolioTestimonial | null> {
    return this.getDb().portfolioTestimonial.findFirst({ where: { ...live(owner), id } });
  }

  public createTestimonial(
    owner: Owner,
    actorId: string,
    data: OwnedCreate<Prisma.PortfolioTestimonialUncheckedCreateInput>,
    limit: number
  ): Promise<PortfolioTestimonial | null> {
    return this.withTransaction(async (tx) => {
      const count = await tx.portfolioTestimonial.count({ where: live(owner) });
      if (count >= limit) return null;
      const last = await tx.portfolioTestimonial.findFirst({
        where: live(owner),
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      return tx.portfolioTestimonial.create({
        data: {
          ...data,
          organizationId: owner.organizationId,
          userId: owner.userId,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
    });
  }

  public async updateTestimonial(
    owner: Owner,
    id: string,
    actorId: string,
    data: Prisma.PortfolioTestimonialUncheckedUpdateInput
  ): Promise<number> {
    const res = await this.getDb().portfolioTestimonial.updateMany({
      where: { ...live(owner), id },
      data: { ...data, updatedBy: actorId },
    });
    return res.count;
  }

  public async softDeleteTestimonial(owner: Owner, id: string, actorId: string): Promise<number> {
    const res = await this.getDb().portfolioTestimonial.updateMany({
      where: { ...live(owner), id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
    return res.count;
  }

  public reorderTestimonials(owner: Owner, actorId: string, ids: string[]): Promise<boolean> {
    return this.withTransaction(async (tx) => {
      const rows = await tx.portfolioTestimonial.findMany({
        where: live(owner),
        select: { id: true },
      });
      if (
        !sameIdSet(
          rows.map((row) => row.id),
          ids
        )
      )
        return false;
      for (const [index, id] of ids.entries()) {
        await tx.portfolioTestimonial.updateMany({
          where: { ...live(owner), id },
          data: { sortOrder: index, updatedBy: actorId },
        });
      }
      return true;
    });
  }

  /** Public page: every live collection row for one owner, in display order. */
  public async publicCollections(owner: Owner): Promise<{
    skills: PortfolioSkill[];
    experiences: PortfolioExperience[];
    education: PortfolioEducation[];
    services: PortfolioServiceItem[];
    testimonials: PortfolioTestimonial[];
  }> {
    const [skills, experiences, education, services, testimonials] = await Promise.all([
      this.listSkills(owner),
      this.listExperiences(owner),
      this.listEducation(owner),
      this.listServices(owner),
      this.listTestimonials(owner),
    ]);
    return { skills, experiences, education, services, testimonials };
  }
}
