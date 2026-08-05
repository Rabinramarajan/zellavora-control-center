import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateDailySheetDTO, UpdateDailySheetDTO, ApproveDailySheetDTO, DailySheetQueryDTO } from './daily-sheets.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class DailySheetsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDailySheetDTO, organizationId: string, userId: string) {
    const totalAmount = new Decimal(dto.hoursWorked).times(new Decimal(dto.hourlyRate));

    const dailySheet = await this.prisma.dailySheet.create({
      data: {
        organizationId,
        userId: dto.userId,
        projectId: dto.projectId,
        sheetDate: new Date(dto.sheetDate),
        hoursWorked: new Decimal(dto.hoursWorked),
        hourlyRate: new Decimal(dto.hourlyRate),
        totalAmount,
        description: dto.description,
        tasksCompleted: dto.tasksCompleted,
        notes: dto.notes,
        createdBy: userId,
        status: 'draft',
        lineItems: {
          create: (dto.lineItems || []).map(item => ({
            taskName: item.taskName,
            description: item.description,
            hours: new Decimal(item.hours),
            rate: item.rate ? new Decimal(item.rate) : new Decimal(dto.hourlyRate),
            amount: new Decimal(item.hours).times(
              item.rate ? new Decimal(item.rate) : new Decimal(dto.hourlyRate)
            ),
          })),
        },
      },
      include: { lineItems: true },
    });

    return dailySheet;
  }

  async update(id: string, dto: UpdateDailySheetDTO, organizationId: string, userId: string) {
    const existingSheet = await this.prisma.dailySheet.findUniqueOrThrow({
      where: { id },
    });

    if (existingSheet.organizationId !== organizationId || existingSheet.status !== 'draft') {
      throw new Error('Cannot update submitted or non-existent sheet');
    }

    const hoursWorked = dto.hoursWorked ?? existingSheet.hoursWorked;
    const hourlyRate = dto.hourlyRate ?? existingSheet.hourlyRate;
    const totalAmount = hoursWorked.times(hourlyRate);

    // Delete existing line items if new ones provided
    if (dto.lineItems) {
      await this.prisma.dailySheetLineItem.deleteMany({
        where: { dailySheetId: id },
      });
    }

    return this.prisma.dailySheet.update({
      where: { id },
      data: {
        hoursWorked: hoursWorked,
        hourlyRate: hourlyRate,
        totalAmount: totalAmount,
        description: dto.description,
        tasksCompleted: dto.tasksCompleted,
        notes: dto.notes,
        updatedBy: userId,
        lineItems: dto.lineItems
          ? {
              create: dto.lineItems.map(item => ({
                taskName: item.taskName,
                description: item.description,
                hours: new Decimal(item.hours),
                rate: item.rate ? new Decimal(item.rate) : hourlyRate,
                amount: new Decimal(item.hours).times(
                  item.rate ? new Decimal(item.rate) : hourlyRate
                ),
              })),
            }
          : undefined,
      },
      include: { lineItems: true },
    });
  }

  async submitForApproval(id: string, organizationId: string, userId: string) {
    const sheet = await this.prisma.dailySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'draft') {
      throw new Error('Cannot submit non-draft sheet');
    }

    return this.prisma.dailySheet.update({
      where: { id },
      data: {
        status: 'submitted',
        updatedBy: userId,
      },
    });
  }

  async approve(id: string, dto: ApproveDailySheetDTO, organizationId: string, userId: string) {
    const sheet = await this.prisma.dailySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'submitted') {
      throw new Error('Cannot approve non-submitted sheet');
    }

    return this.prisma.dailySheet.update({
      where: { id },
      data: {
        status: dto.approved ? 'approved' : 'rejected',
        approvedBy: userId,
        approvedAt: new Date(),
        rejectionReason: dto.rejectionReason,
        updatedBy: userId,
      },
    });
  }

  async getById(id: string, organizationId: string) {
    return this.prisma.dailySheet.findFirstOrThrow({
      where: {
        id,
        organizationId,
      },
      include: { lineItems: true },
    });
  }

  async list(organizationId: string, query: DailySheetQueryDTO) {
    const skip = (query.page - 1) * query.pageSize;

    const where: any = {
      organizationId,
    };

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.sheetDate = {};
      if (query.startDate) {
        where.sheetDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.sheetDate.lte = new Date(query.endDate);
      }
    }

    const [sheets, total] = await Promise.all([
      this.prisma.dailySheet.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { sheetDate: 'desc' },
        include: { lineItems: true },
      }),
      this.prisma.dailySheet.count({ where }),
    ]);

    return {
      data: sheets,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async delete(id: string, organizationId: string) {
    const sheet = await this.prisma.dailySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'draft') {
      throw new Error('Cannot delete non-draft sheet');
    }

    return this.prisma.dailySheet.delete({ where: { id } });
  }
}
