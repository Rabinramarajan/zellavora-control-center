import { Prisma, TimesheetStatus, TimesheetEntryStatus } from '@prisma/client';
import { TxClient } from '../../infrastructure/prisma';
import { logger } from '../../infrastructure/logger';
import { AppError } from '../../middleware/error';
import { NotificationService } from '../notification/notification.service';
import {
  TimesheetsRepository,
  TimesheetWithEntries,
  timesheetInclude,
} from './timesheets.repository';
import {
  buildMonthDays,
  dateKey,
  isDateInPeriod,
  parseDateKey,
  periodOf,
} from './timesheets.calendar';
import {
  assertCanQueryEmployee,
  assertCanView,
  assertEntriesEditable,
  assertNotOwnSheet,
  assertTransition,
  normalizeEntry,
  EntryValues,
  TimesheetViewer,
} from './timesheets.rules';
import {
  BulkUpsertEntriesDTO,
  ListTimesheetsQueryDTO,
  RejectTimesheetDTO,
  SummaryQueryDTO,
  UpdateEntryDTO,
} from './timesheets.dto';

export interface TimesheetTotals {
  totalHours: number;
  workingDays: number;
  leaveDays: number;
  holidayDays: number;
  extendedDays: number;
  weekendWorkDays: number;
}

export interface YearlySummary {
  year: number;
  totalHours: number;
  workingDays: number;
  leaveDays: number;
  approvedPeriods: number;
  periods: Array<{
    period: string;
    status: TimesheetStatus;
    totalHours: number;
    workingDays: number;
    leaveDays: number;
  }>;
}

/** One row of the list endpoint: the sheet without its entries, plus totals. */
export interface TimesheetListItem {
  id: string;
  userId: string;
  period: string;
  status: TimesheetStatus;
  totalHours: number;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  updatedAt: Date;
  user: TimesheetWithEntries['user'];
  approver: TimesheetWithEntries['approver'];
  totals: TimesheetTotals;
}

const toNumber = (value: Prisma.Decimal | number | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

/** Roll a sheet's entries up into the figures the summary card shows. */
export const computeTotals = (
  entries: Array<{ hours: Prisma.Decimal | number | null; status: TimesheetEntryStatus }>
): TimesheetTotals =>
  entries.reduce<TimesheetTotals>(
    (acc, entry) => {
      acc.totalHours += toNumber(entry.hours);
      switch (entry.status) {
        case TimesheetEntryStatus.WORKING:
          acc.workingDays += 1;
          break;
        case TimesheetEntryStatus.EXTENDED:
          acc.workingDays += 1;
          acc.extendedDays += 1;
          break;
        case TimesheetEntryStatus.WEEKEND_WORK:
          acc.workingDays += 1;
          acc.weekendWorkDays += 1;
          break;
        case TimesheetEntryStatus.LEAVE:
          acc.leaveDays += 1;
          break;
        case TimesheetEntryStatus.HOLIDAY:
          acc.holidayDays += 1;
          break;
        default:
          break;
      }
      return acc;
    },
    {
      totalHours: 0,
      workingDays: 0,
      leaveDays: 0,
      holidayDays: 0,
      extendedDays: 0,
      weekendWorkDays: 0,
    }
  );

export class TimesheetsService {
  private readonly repo = new TimesheetsRepository();
  private readonly notifications = new NotificationService();

  /**
   * Fetch the sheet for a period, creating an empty draft the first time the
   * owner asks for it. The draft is pre-filled with one entry per calendar
   * day so the client never has to work out how long the month is or which
   * days fall on a weekend.
   *
   * A reviewer looking at someone else's month only ever reads: opening a
   * colleague's page must not create a draft in their account.
   */
  async getOrCreateForPeriod(
    userId: string,
    period: string,
    organizationId: string,
    viewer: TimesheetViewer
  ): Promise<TimesheetWithEntries> {
    assertCanQueryEmployee(userId, viewer);

    const existing = await this.repo.findByPeriod(userId, period, organizationId);
    if (existing) return existing;

    if (userId !== viewer.userId) {
      throw new AppError('No timesheet for this period', 404, 'TIMESHEET_NOT_FOUND');
    }

    const days = buildMonthDays(period);

    const created = await this.repo.runInTransaction(async (tx) => {
      const sheet = await this.repo.create(
        {
          organizationId,
          userId,
          period,
          status: TimesheetStatus.DRAFT,
          totalHours: new Prisma.Decimal(0),
          createdBy: viewer.userId,
        },
        tx
      );

      await this.repo.createEntries(
        days.map((day) => ({
          timesheetId: sheet.id,
          entryDate: day.date,
          dayOfWeek: day.dayOfWeek,
          status: TimesheetEntryStatus.EMPTY,
        })),
        tx
      );

      return sheet;
    });

    const sheet = await this.repo.findById(created.id, organizationId);
    if (!sheet) throw new AppError('Timesheet creation failed', 500, 'TIMESHEET_CREATE_FAILED');
    return sheet;
  }

  /**
   * Reviewers see the whole organization; everyone else only ever sees their
   * own rows, whatever filter they sent.
   */
  async list(
    organizationId: string,
    dto: ListTimesheetsQueryDTO,
    viewer: TimesheetViewer
  ): Promise<TimesheetListItem[]> {
    assertCanQueryEmployee(dto.employeeId, viewer);

    const sheets = await this.repo.list(organizationId, {
      userId: viewer.canReview ? dto.employeeId : viewer.userId,
      year: dto.year,
      status: dto.status,
    });

    return sheets.map((sheet) => ({
      id: sheet.id,
      userId: sheet.userId,
      period: sheet.period,
      status: sheet.status,
      totalHours: toNumber(sheet.totalHours),
      submittedAt: sheet.submittedAt,
      approvedAt: sheet.approvedAt,
      rejectedAt: sheet.rejectedAt,
      rejectionReason: sheet.rejectionReason,
      updatedAt: sheet.updatedAt,
      user: sheet.user,
      approver: sheet.approver,
      totals: computeTotals(sheet.entries),
    }));
  }

  async getById(id: string, organizationId: string): Promise<TimesheetWithEntries> {
    const sheet = await this.repo.findById(id, organizationId);
    if (!sheet) throw new AppError('Timesheet not found', 404, 'TIMESHEET_NOT_FOUND');
    return sheet;
  }

  /** `getById` for request handlers: also checks the caller may see the sheet. */
  async getVisible(
    id: string,
    organizationId: string,
    viewer: TimesheetViewer
  ): Promise<TimesheetWithEntries> {
    const sheet = await this.getById(id, organizationId);
    assertCanView(sheet, viewer);
    return sheet;
  }

  /** Update one entry. Backs the grid's debounced per-cell autosave. */
  async updateEntry(
    timesheetId: string,
    entryId: string,
    dto: UpdateEntryDTO,
    organizationId: string,
    actorUserId: string
  ): Promise<TimesheetWithEntries> {
    const sheet = await this.getById(timesheetId, organizationId);
    assertEntriesEditable(sheet, actorUserId);

    const entry = await this.repo.findEntry(entryId, timesheetId);
    if (!entry) throw new AppError('Timesheet entry not found', 404, 'ENTRY_NOT_FOUND');

    const values = normalizeEntry(
      { status: entry.status, hours: entry.hours === null ? null : Number(entry.hours) },
      dto
    );

    return this.repo.runInTransaction(async (tx) => {
      await this.repo.updateEntry(entryId, this.toEntryData(values), tx);
      return this.recalculateAndReturn(timesheetId, organizationId, actorUserId, tx);
    });
  }

  /**
   * Upsert several entries in one transaction. Both the grid's batched
   * autosave and its "auto-fill weekdays" action land here.
   */
  async bulkUpsertEntries(
    timesheetId: string,
    dto: BulkUpsertEntriesDTO,
    organizationId: string,
    actorUserId: string
  ): Promise<TimesheetWithEntries> {
    const sheet = await this.getById(timesheetId, organizationId);
    assertEntriesEditable(sheet, actorUserId);

    for (const item of dto.entries) {
      if (!isDateInPeriod(sheet.period, item.date)) {
        throw new AppError(
          `Date ${item.date} is outside period ${sheet.period}`,
          400,
          'DATE_OUTSIDE_PERIOD'
        );
      }
    }

    const existingByDate = new Map(sheet.entries.map((e) => [dateKey(e.entryDate), e]));

    return this.repo.runInTransaction(async (tx) => {
      for (const { date, ...patch } of dto.entries) {
        const current = existingByDate.get(date);
        const values = normalizeEntry(
          {
            status: current?.status ?? TimesheetEntryStatus.EMPTY,
            hours: current?.hours == null ? null : Number(current.hours),
          },
          patch
        );
        const entryDate = parseDateKey(date);
        await this.repo.upsertEntry(
          timesheetId,
          entryDate,
          {
            dayOfWeek: current?.dayOfWeek ?? this.dayNameOf(entryDate),
            ...this.toEntryData(values),
          },
          tx
        );
      }
      return this.recalculateAndReturn(timesheetId, organizationId, actorUserId, tx);
    });
  }

  async submit(
    timesheetId: string,
    organizationId: string,
    actorUserId: string
  ): Promise<TimesheetWithEntries> {
    const sheet = await this.getById(timesheetId, organizationId);
    if (sheet.userId !== actorUserId) {
      throw new AppError(
        'Only the owning employee can submit this timesheet',
        403,
        'NOT_SHEET_OWNER'
      );
    }
    assertTransition(sheet.status, TimesheetStatus.SUBMITTED);

    const updated = await this.repo.runInTransaction(async (tx) => {
      await this.repo.update(
        timesheetId,
        {
          status: TimesheetStatus.SUBMITTED,
          submittedAt: new Date(),
          // A resubmission clears the rejection it is answering.
          rejectedAt: null,
          rejectionReason: null,
          updatedBy: actorUserId,
        },
        tx
      );
      return this.recalculateAndReturn(timesheetId, organizationId, actorUserId, tx);
    });

    await this.notify(updated, 'submitted');
    return updated;
  }

  async approve(
    timesheetId: string,
    organizationId: string,
    approverUserId: string
  ): Promise<TimesheetWithEntries> {
    const sheet = await this.getById(timesheetId, organizationId);
    assertNotOwnSheet(sheet, approverUserId);
    assertTransition(sheet.status, TimesheetStatus.APPROVED);

    await this.repo.update(timesheetId, {
      status: TimesheetStatus.APPROVED,
      approvedById: approverUserId,
      approvedAt: new Date(),
      updatedBy: approverUserId,
    });

    const updated = await this.getById(timesheetId, organizationId);
    await this.notify(updated, 'approved');
    return updated;
  }

  async reject(
    timesheetId: string,
    dto: RejectTimesheetDTO,
    organizationId: string,
    approverUserId: string
  ): Promise<TimesheetWithEntries> {
    const sheet = await this.getById(timesheetId, organizationId);
    assertNotOwnSheet(sheet, approverUserId);
    assertTransition(sheet.status, TimesheetStatus.REJECTED);

    await this.repo.update(timesheetId, {
      status: TimesheetStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: dto.rejectionReason,
      // The sheet becomes editable again, so a stale approval must not linger.
      approvedById: null,
      approvedAt: null,
      updatedBy: approverUserId,
    });

    const updated = await this.getById(timesheetId, organizationId);
    await this.notify(updated, 'rejected');
    return updated;
  }

  /** Per-year rollup for the reports view. */
  async summary(
    organizationId: string,
    dto: SummaryQueryDTO,
    viewer: TimesheetViewer
  ): Promise<YearlySummary> {
    assertCanQueryEmployee(dto.employeeId, viewer);
    const userId = dto.employeeId ?? viewer.userId;
    const sheets = await this.repo.list(organizationId, { userId, year: dto.year });

    const periods = sheets
      .map((sheet) => {
        const totals = computeTotals(sheet.entries);
        return {
          period: sheet.period,
          status: sheet.status,
          totalHours: totals.totalHours,
          workingDays: totals.workingDays,
          leaveDays: totals.leaveDays,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      year: dto.year,
      totalHours: periods.reduce((sum, p) => sum + p.totalHours, 0),
      workingDays: periods.reduce((sum, p) => sum + p.workingDays, 0),
      leaveDays: periods.reduce((sum, p) => sum + p.leaveDays, 0),
      approvedPeriods: periods.filter((p) => p.status === TimesheetStatus.APPROVED).length,
      periods,
    };
  }

  /** Only the keys the patch actually carried reach the database. */
  private toEntryData(values: EntryValues) {
    const data: Record<string, unknown> = {};
    if (values.startTime !== undefined) data['startTime'] = values.startTime;
    if (values.endTime !== undefined) data['endTime'] = values.endTime;
    if (values.hours !== undefined) {
      data['hours'] = values.hours === null ? null : new Prisma.Decimal(values.hours);
    }
    if (values.status !== undefined) data['status'] = values.status;
    if (values.notes !== undefined) data['notes'] = values.notes;
    return data as Omit<
      Prisma.TimesheetEntryUncheckedCreateInput,
      'timesheetId' | 'entryDate' | 'dayOfWeek'
    >;
  }

  private dayNameOf(date: Date): string {
    const day = buildMonthDays(periodOf(date)).find((d) => d.key === dateKey(date));
    if (!day) throw new AppError('Invalid entry date', 400, 'INVALID_ENTRY_DATE');
    return day.dayOfWeek;
  }

  /**
   * `totalHours` is denormalized onto the parent row so list views and
   * exports need not load every entry. It is rewritten inside the same
   * transaction as the entry write that changed it, so the two cannot drift.
   */
  private async recalculateAndReturn(
    timesheetId: string,
    organizationId: string,
    actorUserId: string,
    tx: TxClient
  ): Promise<TimesheetWithEntries> {
    const total = await this.repo.sumHours(timesheetId, tx);
    await this.repo.update(timesheetId, { totalHours: total, updatedBy: actorUserId }, tx);

    const sheet = await tx.timesheet.findFirst({
      where: { id: timesheetId, organizationId, deletedAt: null },
      include: timesheetInclude,
    });
    if (!sheet) throw new AppError('Timesheet not found', 404, 'TIMESHEET_NOT_FOUND');
    return sheet;
  }

  /**
   * Best-effort: a notification outage must not roll back an approval the
   * manager has already been told succeeded.
   */
  private async notify(
    sheet: TimesheetWithEntries,
    event: 'submitted' | 'approved' | 'rejected'
  ): Promise<void> {
    const employee = sheet.user?.fullName ?? 'An employee';
    const messages = {
      submitted: {
        // No single recipient: this lands in the approvers' queue.
        recipientId: null as string | null,
        title: 'Timesheet awaiting approval',
        body: `${employee} submitted their ${sheet.period} timesheet (${Number(sheet.totalHours)}h) for approval.`,
      },
      approved: {
        recipientId: sheet.userId as string | null,
        title: 'Timesheet approved',
        body: `Your ${sheet.period} timesheet was approved.`,
      },
      rejected: {
        recipientId: sheet.userId as string | null,
        title: 'Timesheet rejected',
        body: `Your ${sheet.period} timesheet was rejected: ${sheet.rejectionReason ?? 'no reason given'}`,
      },
    };

    try {
      const message = messages[event];
      await this.notifications.sendNotification({
        organizationId: sheet.organizationId,
        recipientId: message.recipientId,
        title: message.title,
        body: message.body,
        channels: ['in_app'],
      });
    } catch (error) {
      logger.error(`Timesheet ${event} notification failed`, error);
    }
  }
}
