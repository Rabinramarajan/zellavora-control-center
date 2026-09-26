import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import {
  ApproveMonthlySheetDTO,
  CreateMonthlySheetDTO,
  MarkAsPaidDTO,
  MonthlyDocumentQueryDTO,
  MonthlySheetQueryDTO,
} from './monthly-sheets.dto';
import {
  Paged,
  SheetViewer,
  assertCanActFor,
  assertCanDecide,
  assertCanListScope,
  assertCanViewSheet,
  assertOwnerCanChange,
  toDateKey,
} from '../daily-sheets/sheets.shared';
import { MonthlyDocument, buildMonthlyDocument } from './monthly-sheets.document';

const monthlySheetInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.MonthlySheetInclude;

type MonthlySheetRecord = Prisma.MonthlySheetGetPayload<{ include: typeof monthlySheetInclude }>;

/** What the API returns: Decimals as numbers. */
export interface MonthlySheetView {
  id: string;
  userId: string;
  user: { id: string; fullName: string; email: string } | null;
  month: number;
  year: number;
  totalHours: number;
  billableHours: number;
  totalAmount: number;
  averageHourlyRate: number;
  workingDays: number;
  totalSheets: number;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approver: { id: string; fullName: string } | null;
  paidAt: Date | null;
  rejectionReason: string | null;
  dailySheetIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthTotals {
  totalHours: number;
  billableHours: number;
  totalAmount: number;
  averageHourlyRate: number;
  workingDays: number;
}

interface DailyForRollup {
  sheetDate: Date;
  hoursWorked: Prisma.Decimal | number;
  totalAmount: Prisma.Decimal | number;
  isBillable: boolean;
  /** Leave and holiday entries carry no hours and are not working days. */
  entryType?: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Roll daily sheets up into a month. The average rate is over billable
 * hours only, so a non-billable day does not dilute it.
 */
export const rollUpMonth = (sheets: readonly DailyForRollup[]): MonthTotals => {
  let totalHours = 0;
  let billableHours = 0;
  let totalAmount = 0;
  const days = new Set<string>();

  for (const sheet of sheets) {
    const hours = Number(sheet.hoursWorked);
    totalHours += hours;
    if (sheet.isBillable) billableHours += hours;
    totalAmount += Number(sheet.totalAmount);
    if ((sheet.entryType ?? 'work') === 'work' && hours > 0) days.add(toDateKey(sheet.sheetDate));
  }

  return {
    totalHours: round2(totalHours),
    billableHours: round2(billableHours),
    totalAmount: round2(totalAmount),
    averageHourlyRate: billableHours > 0 ? round2(totalAmount / billableHours) : 0,
    workingDays: days.size,
  };
};

/** First and last calendar day of a month, as UTC midnights. */
const monthRange = (year: number, month: number): { gte: Date; lte: Date } => ({
  gte: new Date(Date.UTC(year, month - 1, 1)),
  lte: new Date(Date.UTC(year, month, 0)),
});

const toView = (sheet: MonthlySheetRecord, billableHours: number): MonthlySheetView => ({
  id: sheet.id,
  userId: sheet.userId,
  user: sheet.user,
  month: sheet.month,
  year: sheet.year,
  totalHours: Number(sheet.totalHours),
  billableHours,
  totalAmount: Number(sheet.totalAmount),
  averageHourlyRate: Number(sheet.averageHourlyRate),
  workingDays: sheet.workingDays,
  totalSheets: sheet.dailySheetIds.length,
  status: sheet.status,
  submittedAt: sheet.submittedAt,
  approvedAt: sheet.approvedAt,
  approver: sheet.approver,
  paidAt: sheet.paidAt,
  rejectionReason: sheet.rejectionReason,
  dailySheetIds: sheet.dailySheetIds,
  createdAt: sheet.createdAt,
  updatedAt: sheet.updatedAt,
});

export class MonthlySheetsService {
  /**
   * Generate the month from the owner's approved daily sheets. One monthly
   * sheet per person per month: a second request is a conflict, and the
   * existing sheet should be regenerated instead.
   */
  public async create(
    dto: CreateMonthlySheetDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlySheetView> {
    const ownerId = dto.userId ?? viewer.userId;
    assertCanActFor(ownerId, viewer);

    const existing = await prisma.monthlySheet.findFirst({
      where: { organizationId, userId: ownerId, month: dto.month, year: dto.year },
      select: { id: true, deletedAt: true },
    });
    if (existing && !existing.deletedAt) {
      throw new AppError(
        'A monthly sheet already exists for this month — regenerate it instead',
        409,
        'MONTHLY_SHEET_EXISTS',
        { id: existing.id }
      );
    }

    const dailies = await this.approvedDailies(ownerId, dto.year, dto.month, organizationId);
    const totals = rollUpMonth(dailies);

    const data = {
      totalHours: new Prisma.Decimal(totals.totalHours),
      totalAmount: new Prisma.Decimal(totals.totalAmount),
      averageHourlyRate: new Prisma.Decimal(totals.averageHourlyRate),
      workingDays: totals.workingDays,
      dailySheetIds: dailies.map((sheet) => sheet.id),
      status: 'draft',
    };

    // The unique key ignores soft deletes, so a previously deleted month is
    // revived in place rather than inserted again.
    const sheet = existing
      ? await prisma.monthlySheet.update({
          where: { id: existing.id },
          data: {
            ...data,
            deletedAt: null,
            submittedAt: null,
            approvedBy: null,
            approvedAt: null,
            paidAt: null,
            rejectionReason: null,
            updatedBy: viewer.userId,
          },
          include: monthlySheetInclude,
        })
      : await prisma.monthlySheet.create({
          data: {
            ...data,
            organizationId,
            userId: ownerId,
            month: dto.month,
            year: dto.year,
            createdBy: viewer.userId,
          },
          include: monthlySheetInclude,
        });

    return toView(sheet, totals.billableHours);
  }

  /** Re-read the month's approved daily sheets; a rejected sheet returns to draft. */
  public async regenerate(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlySheetView> {
    const sheet = await this.find(id, organizationId);
    assertOwnerCanChange(sheet, viewer.userId);

    const dailies = await this.approvedDailies(
      sheet.userId,
      sheet.year,
      sheet.month,
      organizationId
    );
    const totals = rollUpMonth(dailies);

    const updated = await prisma.monthlySheet.update({
      where: { id },
      data: {
        totalHours: new Prisma.Decimal(totals.totalHours),
        totalAmount: new Prisma.Decimal(totals.totalAmount),
        averageHourlyRate: new Prisma.Decimal(totals.averageHourlyRate),
        workingDays: totals.workingDays,
        dailySheetIds: dailies.map((daily) => daily.id),
        status: 'draft',
        updatedBy: viewer.userId,
      },
      include: monthlySheetInclude,
    });
    return toView(updated, totals.billableHours);
  }

  public async submitForApproval(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlySheetView> {
    const sheet = await this.find(id, organizationId);
    assertOwnerCanChange(sheet, viewer.userId);
    if (sheet.dailySheetIds.length === 0) {
      throw new AppError(
        'There are no approved daily sheets in this month to submit',
        422,
        'MONTHLY_SHEET_EMPTY'
      );
    }

    const updated = await prisma.monthlySheet.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        rejectionReason: null,
        updatedBy: viewer.userId,
      },
      include: monthlySheetInclude,
    });
    return this.present(updated);
  }

  public async approve(
    id: string,
    dto: ApproveMonthlySheetDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlySheetView> {
    const sheet = await this.find(id, organizationId);
    assertCanDecide(sheet, viewer);
    if (sheet.status !== 'submitted') {
      throw new AppError(
        `Only submitted sheets can be reviewed (this one is ${sheet.status})`,
        409,
        'SHEET_NOT_SUBMITTED'
      );
    }

    const updated = await prisma.monthlySheet.update({
      where: { id },
      data: dto.approved
        ? {
            status: 'approved',
            approvedBy: viewer.userId,
            approvedAt: new Date(),
            rejectionReason: null,
            updatedBy: viewer.userId,
          }
        : {
            status: 'rejected',
            approvedBy: null,
            approvedAt: null,
            rejectionReason: dto.rejectionReason ?? null,
            updatedBy: viewer.userId,
          },
      include: monthlySheetInclude,
    });
    return this.present(updated);
  }

  public async markAsPaid(
    id: string,
    dto: MarkAsPaidDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlySheetView> {
    const sheet = await this.find(id, organizationId);
    assertCanDecide(sheet, viewer);
    if (sheet.status !== 'approved') {
      throw new AppError('Only approved sheets can be marked as paid', 409, 'SHEET_NOT_APPROVED');
    }

    const updated = await prisma.monthlySheet.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        updatedBy: viewer.userId,
      },
      include: monthlySheetInclude,
    });
    return this.present(updated);
  }

  public async getById(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlySheetView> {
    const sheet = await this.find(id, organizationId);
    assertCanViewSheet(sheet, viewer);
    return this.present(sheet);
  }

  /** Non-reviewers only ever see their own sheets, whatever they ask for. */
  public async list(
    organizationId: string,
    query: MonthlySheetQueryDTO,
    viewer: SheetViewer
  ): Promise<Paged<MonthlySheetView>> {
    assertCanListScope(query.scope, viewer);
    assertCanActFor(query.userId, viewer);

    const userId = query.scope === 'team' ? query.userId : (query.userId ?? viewer.userId);
    const where: Prisma.MonthlySheetWhereInput = {
      organizationId,
      deletedAt: null,
      ...(userId ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.month ? { month: query.month } : {}),
      ...(query.year ? { year: query.year } : {}),
    };

    const [sheets, total] = await Promise.all([
      prisma.monthlySheet.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: monthlySheetInclude,
      }),
      prisma.monthlySheet.count({ where }),
    ]);

    const billable = await this.billableHoursFor(sheets);
    return {
      data: sheets.map((sheet) => toView(sheet, billable.get(sheet.id) ?? 0)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Soft delete, so the audit trail keeps the row. */
  public async delete(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<{ id: string }> {
    const sheet = await this.find(id, organizationId);
    assertOwnerCanChange(sheet, viewer.userId);
    await prisma.monthlySheet.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: viewer.userId },
    });
    return { id };
  }

  /**
   * The printable timesheet for one person's month. Once the monthly sheet
   * has been submitted the document shows exactly the daily sheets it was
   * built from; before that it is a live preview of everything not rejected.
   */
  public async document(
    query: MonthlyDocumentQueryDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<MonthlyDocument> {
    const ownerId = query.userId ?? viewer.userId;
    assertCanActFor(ownerId, viewer);

    const employee = await prisma.user.findFirst({
      where: { id: ownerId },
      select: { id: true, fullName: true, department: true, jobTitle: true },
    });
    if (!employee) throw new AppError('Employee not found', 404, 'USER_NOT_FOUND');

    const monthly = await prisma.monthlySheet.findFirst({
      where: {
        organizationId,
        userId: ownerId,
        month: query.month,
        year: query.year,
        deletedAt: null,
      },
      include: monthlySheetInclude,
    });
    const official = monthly && !['draft', 'rejected'].includes(monthly.status);

    const inMonth: Prisma.DailySheetWhereInput = {
      organizationId,
      userId: ownerId,
      deletedAt: null,
      sheetDate: monthRange(query.year, query.month),
    };
    const [dailies, pendingDailyCount] = await Promise.all([
      prisma.dailySheet.findMany({
        where: official
          ? { ...inMonth, id: { in: monthly.dailySheetIds } }
          : { ...inMonth, status: { not: 'rejected' } },
        select: {
          sheetDate: true,
          entryType: true,
          startTime: true,
          endTime: true,
          hoursWorked: true,
          description: true,
        },
        orderBy: [{ sheetDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.dailySheet.count({ where: { ...inMonth, status: { in: ['draft', 'submitted'] } } }),
    ]);

    return buildMonthlyDocument({
      year: query.year,
      month: query.month,
      employee: {
        id: employee.id,
        name: employee.fullName,
        department: employee.department,
        jobTitle: employee.jobTitle,
      },
      dailies: dailies.map((daily) => ({ ...daily, hoursWorked: Number(daily.hoursWorked) })),
      monthly: monthly
        ? {
            id: monthly.id,
            status: monthly.status,
            submittedAt: monthly.submittedAt,
            approvedAt: monthly.approvedAt,
            approverName: monthly.approver?.fullName ?? null,
            paidAt: monthly.paidAt,
          }
        : null,
      pendingDailyCount,
    });
  }

  private approvedDailies(
    userId: string,
    year: number,
    month: number,
    organizationId: string
  ): Promise<Array<DailyForRollup & { id: string }>> {
    return prisma.dailySheet.findMany({
      where: {
        organizationId,
        userId,
        status: 'approved',
        deletedAt: null,
        sheetDate: monthRange(year, month),
      },
      select: {
        id: true,
        sheetDate: true,
        hoursWorked: true,
        totalAmount: true,
        isBillable: true,
        entryType: true,
      },
      orderBy: { sheetDate: 'asc' },
    });
  }

  private async find(id: string, organizationId: string): Promise<MonthlySheetRecord> {
    const sheet = await prisma.monthlySheet.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: monthlySheetInclude,
    });
    if (!sheet) throw new AppError('Sheet not found', 404, 'SHEET_NOT_FOUND');
    return sheet;
  }

  private async present(sheet: MonthlySheetRecord): Promise<MonthlySheetView> {
    const billable = await this.billableHoursFor([sheet]);
    return toView(sheet, billable.get(sheet.id) ?? 0);
  }

  /** Billable hours are not stored on the month, so they are summed from its dailies. */
  private async billableHoursFor(
    sheets: ReadonlyArray<{ id: string; dailySheetIds: string[] }>
  ): Promise<Map<string, number>> {
    const ids = [...new Set(sheets.flatMap((sheet) => sheet.dailySheetIds))];
    if (!ids.length) return new Map();

    const dailies = await prisma.dailySheet.findMany({
      where: { id: { in: ids }, isBillable: true },
      select: { id: true, hoursWorked: true },
    });
    const hoursById = new Map(dailies.map((daily) => [daily.id, Number(daily.hoursWorked)]));

    return new Map(
      sheets.map((sheet) => [
        sheet.id,
        round2(sheet.dailySheetIds.reduce((sum, id) => sum + (hoursById.get(id) ?? 0), 0)),
      ])
    );
  }
}
