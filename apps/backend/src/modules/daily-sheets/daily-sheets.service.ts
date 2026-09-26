import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { AppError } from '../../middleware/error';
import {
  ApproveDailySheetDTO,
  CreateDailySheetDTO,
  DailySheetLineItemDTO,
  DailySheetQueryDTO,
  ENTRY_TYPES,
  EntryType,
  UpdateDailySheetDTO,
} from './daily-sheets.dto';
import {
  Paged,
  SheetViewer,
  assertCanActFor,
  assertCanDecide,
  assertCanListScope,
  assertCanViewSheet,
  assertOwnerCanChange,
  hoursBetween,
  toDateKey,
} from './sheets.shared';

const dailySheetInclude = {
  lineItems: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, fullName: true, email: true } },
  approver: { select: { id: true, fullName: true } },
} satisfies Prisma.DailySheetInclude;

type DailySheetRecord = Prisma.DailySheetGetPayload<{ include: typeof dailySheetInclude }>;

export interface DailySheetLineItemView {
  id: string;
  taskName: string;
  description: string | null;
  hours: number;
  rate: number | null;
  amount: number;
}

/** What the API returns: Decimals as numbers, the date as "YYYY-MM-DD". */
export interface DailySheetView {
  id: string;
  userId: string;
  user: { id: string; fullName: string; email: string } | null;
  projectId: string | null;
  projectName: string | null;
  entryType: EntryType;
  sheetDate: string;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  hoursWorked: number;
  billableHours: number;
  hourlyRate: number;
  totalAmount: number;
  isBillable: boolean;
  description: string | null;
  tasksCompleted: string | null;
  taskName: string | null;
  notes: string | null;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approver: { id: string; fullName: string } | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItems: DailySheetLineItemView[];
}

export interface HoursInput {
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number;
  hoursWorked?: number;
  lineItems?: DailySheetLineItemDTO[];
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The hours a sheet records. A start/end span wins because it is what the
 * user actually entered; otherwise explicit hours, otherwise the task total.
 * Tasks may break the day down but never add up to more than it.
 */
export const resolveHours = (input: HoursInput): number => {
  const taskHours = round2((input.lineItems ?? []).reduce((sum, item) => sum + item.hours, 0));

  let hours: number;
  if (input.startTime && input.endTime) {
    hours = hoursBetween(input.startTime, input.endTime, input.breakMinutes ?? 0);
    if (hours <= 0) {
      throw new AppError('The break is as long as the time worked', 400, 'INVALID_BREAK');
    }
  } else if (input.hoursWorked) {
    hours = round2(input.hoursWorked);
  } else {
    hours = taskHours;
  }

  if (hours <= 0 || hours > 24) {
    throw new AppError('Hours worked must be between 0 and 24', 400, 'INVALID_HOURS');
  }
  if (taskHours > hours + 0.001) {
    throw new AppError(
      `Tasks add up to ${taskHours}h, more than the ${hours}h worked`,
      400,
      'TASKS_EXCEED_HOURS'
    );
  }
  return hours;
};

/**
 * Tasks may carry their own rate; any hours not assigned to a task bill at
 * the sheet rate. Non-billable days are worth nothing to the client.
 */
export const computeAmounts = (
  hours: number,
  rate: number,
  isBillable: boolean,
  lineItems: DailySheetLineItemDTO[]
): {
  totalAmount: number;
  items: Array<DailySheetLineItemDTO & { rate: number; amount: number }>;
} => {
  const items = lineItems.map((item) => {
    const itemRate = item.rate ?? rate;
    return { ...item, rate: itemRate, amount: round2(item.hours * itemRate) };
  });
  if (!isBillable) return { totalAmount: 0, items };

  const taskHours = items.reduce((sum, item) => sum + item.hours, 0);
  const taskAmount = items.reduce((sum, item) => sum + item.amount, 0);
  return { totalAmount: round2(taskAmount + Math.max(hours - taskHours, 0) * rate), items };
};

const toNumber = (value: Prisma.Decimal | number | null): number =>
  value === null ? 0 : Number(value);

export const toDailySheetView = (
  sheet: DailySheetRecord,
  projectNames: ReadonlyMap<string, string>
): DailySheetView => {
  const hoursWorked = toNumber(sheet.hoursWorked);
  return {
    id: sheet.id,
    userId: sheet.userId,
    user: sheet.user,
    projectId: sheet.projectId,
    projectName: sheet.projectId ? (projectNames.get(sheet.projectId) ?? null) : null,
    entryType: asEntryType(sheet.entryType),
    sheetDate: toDateKey(sheet.sheetDate),
    startTime: sheet.startTime,
    endTime: sheet.endTime,
    breakMinutes: sheet.breakMinutes,
    hoursWorked,
    billableHours: sheet.isBillable ? hoursWorked : 0,
    hourlyRate: toNumber(sheet.hourlyRate),
    totalAmount: toNumber(sheet.totalAmount),
    isBillable: sheet.isBillable,
    description: sheet.description,
    tasksCompleted: sheet.tasksCompleted,
    taskName: sheet.lineItems[0]?.taskName ?? null,
    notes: sheet.notes,
    status: sheet.status,
    submittedAt: sheet.submittedAt,
    approvedAt: sheet.approvedAt,
    approver: sheet.approver,
    rejectionReason: sheet.rejectionReason,
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
    lineItems: sheet.lineItems.map((item) => ({
      id: item.id,
      taskName: item.taskName,
      description: item.description,
      hours: toNumber(item.hours),
      rate: item.rate === null ? null : toNumber(item.rate),
      amount: toNumber(item.amount),
    })),
  };
};

export interface SheetValuesInput extends HoursInput {
  entryType: EntryType;
  hourlyRate: number;
  isBillable: boolean;
  lineItems: DailySheetLineItemDTO[];
}

export interface SheetValues {
  entryType: EntryType;
  hours: number;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  rate: number;
  isBillable: boolean;
  totalAmount: number;
  items: ReturnType<typeof computeAmounts>['items'];
}

/**
 * Everything derived about a sheet, in one place. Leave and holiday days
 * record the absence only: no times, hours, tasks or amount.
 */
export const computeSheetValues = (input: SheetValuesInput): SheetValues => {
  if (input.entryType !== 'work') {
    return {
      entryType: input.entryType,
      hours: 0,
      startTime: null,
      endTime: null,
      breakMinutes: 0,
      rate: input.hourlyRate,
      isBillable: false,
      totalAmount: 0,
      items: [],
    };
  }

  const hours = resolveHours(input);
  const { totalAmount, items } = computeAmounts(
    hours,
    input.hourlyRate,
    input.isBillable,
    input.lineItems
  );
  return {
    entryType: 'work',
    hours,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    breakMinutes: input.startTime ? (input.breakMinutes ?? 0) : 0,
    rate: input.hourlyRate,
    isBillable: input.isBillable,
    totalAmount,
    items,
  };
};

const valueColumns = (
  values: SheetValues
): Pick<
  Prisma.DailySheetUncheckedCreateInput,
  | 'entryType'
  | 'startTime'
  | 'endTime'
  | 'breakMinutes'
  | 'hoursWorked'
  | 'hourlyRate'
  | 'totalAmount'
  | 'isBillable'
> => ({
  entryType: values.entryType,
  startTime: values.startTime,
  endTime: values.endTime,
  breakMinutes: values.breakMinutes,
  hoursWorked: new Prisma.Decimal(values.hours),
  hourlyRate: new Prisma.Decimal(values.rate),
  totalAmount: new Prisma.Decimal(values.totalAmount),
  isBillable: values.isBillable,
});

const asEntryType = (value: string): EntryType =>
  (ENTRY_TYPES as readonly string[]).includes(value) ? (value as EntryType) : 'work';

const lineItemRows = (
  items: ReturnType<typeof computeAmounts>['items']
): Prisma.DailySheetLineItemCreateWithoutDailySheetInput[] =>
  items.map((item) => ({
    taskName: item.taskName,
    description: item.description ?? null,
    hours: new Prisma.Decimal(item.hours),
    rate: new Prisma.Decimal(item.rate),
    amount: new Prisma.Decimal(item.amount),
  }));

export class DailySheetsService {
  public async create(
    dto: CreateDailySheetDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<DailySheetView> {
    const ownerId = dto.userId ?? viewer.userId;
    assertCanActFor(ownerId, viewer);
    await this.assertProjectInOrg(dto.projectId, organizationId);

    const entryType = dto.entryType ?? 'work';
    await this.assertDayAccepts(ownerId, dto.sheetDate, entryType, organizationId);

    const values = computeSheetValues({
      entryType,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      breakMinutes: dto.breakMinutes ?? 0,
      hoursWorked: dto.hoursWorked,
      hourlyRate: dto.hourlyRate ?? 0,
      isBillable: dto.isBillable ?? true,
      lineItems: dto.lineItems ?? [],
    });

    const created = await prisma.dailySheet.create({
      data: {
        organizationId,
        userId: ownerId,
        projectId: dto.projectId ?? null,
        sheetDate: new Date(`${dto.sheetDate}T00:00:00.000Z`),
        ...valueColumns(values),
        description: dto.description ?? null,
        tasksCompleted: dto.tasksCompleted ?? null,
        notes: dto.notes ?? null,
        status: 'draft',
        createdBy: viewer.userId,
        lineItems: { create: lineItemRows(values.items) },
      },
      include: dailySheetInclude,
    });

    return this.present(created, organizationId);
  }

  /**
   * Any field left out keeps its stored value, and hours and amounts are
   * recomputed from the merged result so they can never disagree. Editing a
   * rejected sheet returns it to draft for another round.
   */
  public async update(
    id: string,
    dto: UpdateDailySheetDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<DailySheetView> {
    const existing = await this.find(id, organizationId);
    assertOwnerCanChange(existing, viewer.userId);
    if (dto.projectId !== undefined) await this.assertProjectInOrg(dto.projectId, organizationId);

    const lineItems: DailySheetLineItemDTO[] =
      dto.lineItems ??
      existing.lineItems.map((item) => ({
        taskName: item.taskName,
        description: item.description ?? undefined,
        hours: toNumber(item.hours),
        rate: item.rate === null ? undefined : toNumber(item.rate),
      }));

    const entryType = dto.entryType ?? asEntryType(existing.entryType);
    const sheetDate = dto.sheetDate ?? toDateKey(existing.sheetDate);
    if (entryType !== existing.entryType || sheetDate !== toDateKey(existing.sheetDate)) {
      await this.assertDayAccepts(existing.userId, sheetDate, entryType, organizationId, id);
    }

    const values = computeSheetValues({
      entryType,
      startTime: dto.startTime !== undefined ? dto.startTime : existing.startTime,
      endTime: dto.endTime !== undefined ? dto.endTime : existing.endTime,
      breakMinutes: dto.breakMinutes ?? existing.breakMinutes,
      hoursWorked: dto.hoursWorked ?? toNumber(existing.hoursWorked),
      hourlyRate: dto.hourlyRate ?? toNumber(existing.hourlyRate),
      isBillable: dto.isBillable ?? existing.isBillable,
      lineItems,
    });
    // Switching to leave drops any tasks, so the stored rows must go too.
    const replaceItems = dto.lineItems !== undefined || entryType !== 'work';

    const updated = await prisma.$transaction(async (tx) => {
      if (replaceItems) {
        await tx.dailySheetLineItem.deleteMany({ where: { dailySheetId: id } });
      }
      return tx.dailySheet.update({
        where: { id },
        data: {
          sheetDate: new Date(`${sheetDate}T00:00:00.000Z`),
          ...(dto.projectId !== undefined ? { projectId: dto.projectId } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.tasksCompleted !== undefined ? { tasksCompleted: dto.tasksCompleted } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...valueColumns(values),
          status: 'draft',
          updatedBy: viewer.userId,
          ...(replaceItems ? { lineItems: { create: lineItemRows(values.items) } } : {}),
        },
        include: dailySheetInclude,
      });
    });

    return this.present(updated, organizationId);
  }

  public async submitForApproval(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<DailySheetView> {
    const sheet = await this.find(id, organizationId);
    assertOwnerCanChange(sheet, viewer.userId);

    const updated = await prisma.dailySheet.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        rejectionReason: null,
        updatedBy: viewer.userId,
      },
      include: dailySheetInclude,
    });
    return this.present(updated, organizationId);
  }

  public async approve(
    id: string,
    dto: ApproveDailySheetDTO,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<DailySheetView> {
    const sheet = await this.find(id, organizationId);
    assertCanDecide(sheet, viewer);
    if (sheet.status !== 'submitted') {
      throw new AppError(
        `Only submitted sheets can be reviewed (this one is ${sheet.status})`,
        409,
        'SHEET_NOT_SUBMITTED'
      );
    }

    const updated = await prisma.dailySheet.update({
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
      include: dailySheetInclude,
    });
    return this.present(updated, organizationId);
  }

  public async getById(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<DailySheetView> {
    const sheet = await this.find(id, organizationId);
    assertCanViewSheet(sheet, viewer);
    return this.present(sheet, organizationId);
  }

  /** Non-reviewers only ever see their own sheets, whatever they ask for. */
  public async list(
    organizationId: string,
    query: DailySheetQueryDTO,
    viewer: SheetViewer
  ): Promise<Paged<DailySheetView>> {
    assertCanListScope(query.scope, viewer);
    assertCanActFor(query.userId, viewer);

    const userId = query.scope === 'team' ? query.userId : (query.userId ?? viewer.userId);
    const where: Prisma.DailySheetWhereInput = {
      organizationId,
      deletedAt: null,
      ...(userId ? { userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.startDate || query.endDate
        ? {
            sheetDate: {
              ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
              ...(query.endDate ? { lte: new Date(`${query.endDate}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    };

    const [sheets, total] = await Promise.all([
      prisma.dailySheet.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ sheetDate: 'desc' }, { createdAt: 'desc' }],
        include: dailySheetInclude,
      }),
      prisma.dailySheet.count({ where }),
    ]);

    const names = await this.projectNames(sheets, organizationId);
    return {
      data: sheets.map((sheet) => toDailySheetView(sheet, names)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Projects a sheet can be booked against: the organization's active ones. */
  public async projectOptions(
    organizationId: string
  ): Promise<Array<{ id: string; name: string }>> {
    return prisma.project.findMany({
      where: { organizationId, status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** Soft delete, so the audit trail keeps the row. */
  public async delete(
    id: string,
    organizationId: string,
    viewer: SheetViewer
  ): Promise<{ id: string }> {
    const sheet = await this.find(id, organizationId);
    assertOwnerCanChange(sheet, viewer.userId);
    await prisma.dailySheet.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: viewer.userId },
    });
    return { id };
  }

  private async find(id: string, organizationId: string): Promise<DailySheetRecord> {
    const sheet = await prisma.dailySheet.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: dailySheetInclude,
    });
    if (!sheet) throw new AppError('Sheet not found', 404, 'SHEET_NOT_FOUND');
    return sheet;
  }

  private async present(sheet: DailySheetRecord, organizationId: string): Promise<DailySheetView> {
    return toDailySheetView(sheet, await this.projectNames([sheet], organizationId));
  }

  private async projectNames(
    sheets: ReadonlyArray<{ projectId: string | null }>,
    organizationId: string
  ): Promise<Map<string, string>> {
    const ids = [...new Set(sheets.map((s) => s.projectId).filter((id): id is string => !!id))];
    if (!ids.length) return new Map();
    const projects = await prisma.project.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true, name: true },
    });
    return new Map(projects.map((project) => [project.id, project.name]));
  }

  /**
   * A day is either worked or an absence. Several work entries may share a
   * day (one per project), but a leave or holiday stands alone. Rejected
   * sheets are ignored: they are being corrected, not counted.
   */
  private async assertDayAccepts(
    userId: string,
    sheetDate: string,
    entryType: EntryType,
    organizationId: string,
    excludeId?: string
  ): Promise<void> {
    const others = await prisma.dailySheet.findMany({
      where: {
        organizationId,
        userId,
        deletedAt: null,
        status: { not: 'rejected' },
        sheetDate: new Date(`${sheetDate}T00:00:00.000Z`),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { entryType: true },
    });
    if (!others.length) return;

    if (entryType !== 'work') {
      throw new AppError(
        `${sheetDate} already has entries; remove them before marking the day as ${entryType}`,
        409,
        'DAY_ALREADY_LOGGED'
      );
    }
    const absence = others.find((other) => other.entryType !== 'work');
    if (absence) {
      throw new AppError(
        `${sheetDate} is recorded as ${absence.entryType}; change that entry to log work`,
        409,
        'DAY_IS_ABSENCE'
      );
    }
  }

  private async assertProjectInOrg(
    projectId: string | null | undefined,
    organizationId: string
  ): Promise<void> {
    if (!projectId) return;
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new AppError('Project not found', 400, 'PROJECT_NOT_FOUND');
  }
}
