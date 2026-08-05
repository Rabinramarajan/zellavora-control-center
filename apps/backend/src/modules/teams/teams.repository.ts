import { prisma } from '../../infrastructure/prisma';
import { CreateTeamDTOType, UpdateTeamDTOType, AddTeamMemberDTOType } from './teams.dto';

export class TeamsRepository {
  async create(data: CreateTeamDTOType) {
    return prisma.team.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
        members: {
          connect: data.members?.map(id => ({ id })) || [],
        },
      },
      include: {
        members: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
      },
    });
  }

  async findById(id: string) {
    return prisma.team.findUnique({
      where: { id },
      include: {
        members: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true, name: true } },
        updatedBy: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async findAll(organizationId: string, options?: {
    skip?: number;
    take?: number;
    search?: string;
    sortBy?: 'recent' | 'name' | 'members';
  }) {
    const where: any = { organizationId, deletedAt: null };

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
      case 'members':
        orderBy._count = { members: 'desc' };
        break;
      case 'recent':
      default:
        orderBy.createdAt = 'desc';
    }

    return prisma.team.findMany({
      where,
      skip: options?.skip || 0,
      take: options?.take || 20,
      orderBy,
      include: {
        members: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } },
        createdBy: { select: { id: true, email: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async count(organizationId: string) {
    return prisma.team.count({
      where: { organizationId, deletedAt: null },
    });
  }

  async update(id: string, data: UpdateTeamDTOType, userId: string) {
    return prisma.team.update({
      where: { id },
      data: {
        ...data,
        updatedBy: { connect: { id: userId } },
      },
      include: {
        members: { select: { id: true, email: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.team.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addMember(teamId: string, userId: string, role: string) {
    return prisma.team.update({
      where: { id: teamId },
      data: {
        members: { connect: { id: userId } },
      },
      include: {
        members: { select: { id: true, email: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async removeMember(teamId: string, userId: string) {
    return prisma.team.update({
      where: { id: teamId },
      data: {
        members: { disconnect: { id: userId } },
      },
      include: {
        members: { select: { id: true, email: true, name: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async getMembers(teamId: string, skip = 0, take = 20) {
    return prisma.user.findMany({
      where: {
        teams: { some: { id: teamId } },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
      skip,
      take,
    });
  }

  async getMemberCount(teamId: string) {
    return prisma.user.count({
      where: {
        teams: { some: { id: teamId } },
        deletedAt: null,
      },
    });
  }
}
