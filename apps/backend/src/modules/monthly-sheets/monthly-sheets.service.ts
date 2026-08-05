import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  CreateMonthlySheetDTO,
  UpdateMonthlySheetDTO,
  ApproveMonthlySheetDTO,
  MarkAsPaidDTO,
  MonthlySheetQueryDTO,
} from './monthly-sheets.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class MonthlySheetsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMonthlySheetDTO, organizationId: string, userId: string) {
    // Get all daily sheets for calculation
    const dailySheets = await this.prisma.dailySheet.findMany({
      where: {
        id: { in: dto.dailySheetIds },
        organizationId,
        status: 'approved',
      },
    });

    // Calculate totals
    let totalHours = new Decimal(0);
    let totalAmount = new Decimal(0);
    const workingDays = new Set<string>();

    dailySheets.forEach(sheet => {
      totalHours = totalHours.plus(sheet.hoursWorked);
      totalAmount = totalAmount.plus(sheet.totalAmount);
      workingDays.add(sheet.sheetDate.toISOString().split('T')[0]);
    });

    const averageHourlyRate = totalHours.greaterThan(0)
      ? totalAmount.dividedBy(totalHours)
      : new Decimal(0);

    const monthlySheet = await this.prisma.monthlySheet.create({
      data: {
        organizationId,
        userId: dto.userId,
        projectId: dto.projectId,
        month: dto.month,
        year: dto.year,
        totalHours,
        totalAmount,
        averageHourlyRate,
        workingDays: workingDays.size,
        dailySheetIds: dto.dailySheetIds,
        createdBy: userId,
        status: 'draft',
      },
    });

    return monthlySheet;
  }

  async update(id: string, dto: UpdateMonthlySheetDTO, organizationId: string, userId: string) {
    const existingSheet = await this.prisma.monthlySheet.findUniqueOrThrow({
      where: { id },
    });

    if (existingSheet.organizationId !== organizationId || existingSheet.status !== 'draft') {
      throw new Error('Cannot update submitted or non-existent sheet');
    }

    // Recalculate if daily sheet IDs changed
    if (dto.dailySheetIds) {
      const dailySheets = await this.prisma.dailySheet.findMany({
        where: {
          id: { in: dto.dailySheetIds },
          organizationId,
          status: 'approved',
        },
      });

      let totalHours = new Decimal(0);
      let totalAmount = new Decimal(0);
      const workingDays = new Set<string>();

      dailySheets.forEach(sheet => {
        totalHours = totalHours.plus(sheet.hoursWorked);
        totalAmount = totalAmount.plus(sheet.totalAmount);
        workingDays.add(sheet.sheetDate.toISOString().split('T')[0]);
      });

      const averageHourlyRate = totalHours.greaterThan(0)
        ? totalAmount.dividedBy(totalHours)
        : new Decimal(0);

      return this.prisma.monthlySheet.update({
        where: { id },
        data: {
          totalHours,
          totalAmount,
          averageHourlyRate,
          workingDays: workingDays.size,
          dailySheetIds: dto.dailySheetIds,
          updatedBy: userId,
        },
      });
    }

    return this.prisma.monthlySheet.update({
      where: { id },
      data: {
        updatedBy: userId,
      },
    });
  }

  async submitForApproval(id: string, organizationId: string, userId: string) {
    const sheet = await this.prisma.monthlySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'draft') {
      throw new Error('Cannot submit non-draft sheet');
    }

    return this.prisma.monthlySheet.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        updatedBy: userId,
      },
    });
  }

  async approve(id: string, dto: ApproveMonthlySheetDTO, organizationId: string, userId: string) {
    const sheet = await this.prisma.monthlySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'submitted') {
      throw new Error('Cannot approve non-submitted sheet');
    }

    return this.prisma.monthlySheet.update({
      where: { id },
      data: {
        status: dto.approved ? 'approved' : 'rejected',
        approvedBy: userId,
        approvedAt: dto.approved ? new Date() : undefined,
        rejectionReason: dto.rejectionReason,
        updatedBy: userId,
      },
    });
  }

  async markAsPaid(id: string, dto: MarkAsPaidDTO, organizationId: string, userId: string) {
    const sheet = await this.prisma.monthlySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'approved') {
      throw new Error('Cannot mark non-approved sheet as paid');
    }

    return this.prisma.monthlySheet.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        updatedBy: userId,
      },
    });
  }

  async getById(id: string, organizationId: string) {
    return this.prisma.monthlySheet.findFirstOrThrow({
      where: {
        id,
        organizationId,
      },
    });
  }

  async list(organizationId: string, query: MonthlySheetQueryDTO) {
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

    if (query.month) {
      where.month = query.month;
    }

    if (query.year) {
      where.year = query.year;
    }

    const [sheets, total] = await Promise.all([
      this.prisma.monthlySheet.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      this.prisma.monthlySheet.count({ where }),
    ]);

    return {
      data: sheets,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async delete(id: string, organizationId: string) {
    const sheet = await this.prisma.monthlySheet.findUniqueOrThrow({
      where: { id },
    });

    if (sheet.organizationId !== organizationId || sheet.status !== 'draft') {
      throw new Error('Cannot delete non-draft sheet');
    }

    return this.prisma.monthlySheet.delete({ where: { id } });
  }
}
