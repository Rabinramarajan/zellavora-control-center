import { Prisma, TimesheetStatus } from '@prisma/client';
import { BaseRepository, TxClient } from '../../infrastructure/prisma';

/** A timesheet with its entries in calendar order plus the names we render. */
export const timesheetInclude = {
  entries: { orderBy: { entryDate: 'asc' } },
  user: { select: { id: true, fullName: true, email: true, jobTitle: true } },
  approver: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.TimesheetInclude;

export type TimesheetWithEntries = Prisma.TimesheetGetPayload<{
  include: typeof timesheetInclude;
}>;

export class TimesheetsRepository extends BaseRepository {
  /**
   * Every read is keyed on organizationId as well as the row id, so a caller
   * holding an id from another tenant simply gets nothing back.
   */
  async findById(id: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).timesheet.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: timesheetInclude,
    });
  }

  async findByPeriod(userId: string, period: string, organizationId: string, tx?: TxClient) {
    return this.getDb(tx).timesheet.findFirst({
      where: { userId, period, organizationId, deletedAt: null },
      include: timesheetInclude,
    });
  }

  async list(
    organizationId: string,
    filters: { userId?: string; year?: number; status?: TimesheetStatus },
    tx?: TxClient
  ) {
    return this.getDb(tx).timesheet.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.year ? { period: { startsWith: `${filters.year}-` } } : {}),
      },
      include: timesheetInclude,
      orderBy: { period: 'desc' },
    });
  }

  async create(
    data: Prisma.TimesheetUncheckedCreateInput,
    tx?: TxClient
  ): Promise<{ id: string }> {
    return this.getDb(tx).timesheet.create({ data, select: { id: true } });
  }

  async update(id: string, data: Prisma.TimesheetUncheckedUpdateInput, tx?: TxClient) {
    return this.getDb(tx).timesheet.update({ where: { id }, data });
  }

  async findEntry(entryId: string, timesheetId: string, tx?: TxClient) {
    return this.getDb(tx).timesheetEntry.findFirst({ where: { id: entryId, timesheetId } });
  }

  async updateEntry(
    entryId: string,
    data: Prisma.TimesheetEntryUncheckedUpdateInput,
    tx?: TxClient
  ) {
    return this.getDb(tx).timesheetEntry.update({ where: { id: entryId }, data });
  }

  async upsertEntry(
    timesheetId: string,
    entryDate: Date,
    data: Omit<Prisma.TimesheetEntryUncheckedCreateInput, 'timesheetId' | 'entryDate'>,
    tx?: TxClient
  ) {
    return this.getDb(tx).timesheetEntry.upsert({
      where: { timesheetId_entryDate: { timesheetId, entryDate } },
      create: { ...data, timesheetId, entryDate },
      update: {
        startTime: data.startTime,
        endTime: data.endTime,
        hours: data.hours,
        status: data.status,
        notes: data.notes,
      },
    });
  }

  async createEntries(data: Prisma.TimesheetEntryCreateManyInput[], tx?: TxClient) {
    return this.getDb(tx).timesheetEntry.createMany({ data, skipDuplicates: true });
  }

  /** Sum of every entry's hours — the source of truth for `totalHours`. */
  async sumHours(timesheetId: string, tx?: TxClient) {
    const result = await this.getDb(tx).timesheetEntry.aggregate({
      where: { timesheetId },
      _sum: { hours: true },
    });
    return result._sum.hours ?? new Prisma.Decimal(0);
  }

  /** Exposed so the service can wrap multi-step writes in one transaction. */
  runInTransaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }
}
