import { prisma } from '../../infrastructure/prisma';
import { CreateProjectDTOType, UpdateProjectDTOType } from './projects.dto';

export class ProjectsRepository {
  async create(data: CreateProjectDTOType) {
    return prisma.project.create({
      data: {
        name: data.title || 'Untitled',
        description: data.description,
        status: data.status,
        organizationId: data.organizationId,
      },
    });
  }

  async findById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async findAll(organizationId: string, options?: {
    skip?: number;
    take?: number;
    status?: string;
    search?: string;
    sortBy?: 'recent' | 'name' | 'status';
  }) {
    const where: any = { organizationId, deletedAt: null };

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    switch (options?.sortBy) {
      case 'name':
        orderBy.name = 'asc';
        break;
      case 'status':
        orderBy.status = 'asc';
        break;
      case 'recent':
      default:
        orderBy.createdAt = 'desc';
    }

    return prisma.project.findMany({
      where,
      skip: options?.skip || 0,
      take: options?.take || 20,
      orderBy,
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async count(organizationId: string) {
    return prisma.project.count({
      where: { organizationId, deletedAt: null },
    });
  }

  async update(id: string, data: UpdateProjectDTOType, userId: string) {
    return prisma.project.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId,
      },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(id: string, status: string, userId: string) {
    return prisma.project.update({
      where: { id },
      data: {
        status,
        updatedBy: userId,
      },
    });
  }

  async delete(id: string) {
    return prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getStats(organizationId: string) {
    const [total, draft, published, archived] = await Promise.all([
      prisma.project.count({ where: { organizationId, deletedAt: null } }),
      prisma.project.count({ where: { organizationId, status: 'draft', deletedAt: null } }),
      prisma.project.count({ where: { organizationId, status: 'published', deletedAt: null } }),
      prisma.project.count({ where: { organizationId, status: 'archived', deletedAt: null } }),
    ]);

    return { total, draft, published, archived };
  }
}
