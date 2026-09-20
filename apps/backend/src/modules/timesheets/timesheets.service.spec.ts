import { Prisma, TimesheetStatus, TimesheetEntryStatus } from '@prisma/client';
import { TimesheetsService, computeTotals } from './timesheets.service';
import { TimesheetsRepository } from './timesheets.repository';

jest.mock('./timesheets.repository');
jest.mock('../notification/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const EMPLOYEE = 'employee-1';
const MANAGER = 'manager-1';

const entry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'entry-1',
  timesheetId: 'sheet-1',
  entryDate: new Date('2026-08-03T00:00:00.000Z'),
  dayOfWeek: 'Monday',
  startTime: null,
  endTime: null,
  hours: null as Prisma.Decimal | null,
  status: TimesheetEntryStatus.EMPTY,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const sheet = (overrides: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 'sheet-1',
    organizationId: ORG_A,
    userId: EMPLOYEE,
    period: '2026-08',
    status: TimesheetStatus.DRAFT,
    totalHours: new Prisma.Decimal(0),
    submittedAt: null,
    approvedById: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdBy: EMPLOYEE,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    entries: [entry()],
    user: { id: EMPLOYEE, fullName: 'Ada Lovelace', email: 'ada@example.com', jobTitle: 'Engineer' },
    approver: null,
    ...overrides,
  }) as any;

describe('TimesheetsService', () => {
  let service: TimesheetsService;
  let repo: jest.Mocked<TimesheetsRepository>;
  /** What `recalculateAndReturn` reads back inside the transaction. */
  let txResult: any;

  beforeEach(() => {
    repo = new TimesheetsRepository() as jest.Mocked<TimesheetsRepository>;
    service = new TimesheetsService();
    (service as any).repo = repo;

    txResult = sheet();
    repo.runInTransaction.mockImplementation((fn: any) =>
      fn({ timesheet: { findFirst: jest.fn().mockResolvedValue(txResult) } })
    );
    repo.sumHours.mockResolvedValue(new Prisma.Decimal(0));
    repo.update.mockResolvedValue({} as any);
  });

  describe('computeTotals', () => {
    it('sums hours and counts each kind of day', () => {
      const totals = computeTotals([
        { hours: new Prisma.Decimal(8), status: TimesheetEntryStatus.WORKING },
        { hours: new Prisma.Decimal(9.5), status: TimesheetEntryStatus.EXTENDED },
        { hours: new Prisma.Decimal(4), status: TimesheetEntryStatus.WEEKEND_WORK },
        { hours: null, status: TimesheetEntryStatus.LEAVE },
        { hours: null, status: TimesheetEntryStatus.HOLIDAY },
        { hours: null, status: TimesheetEntryStatus.EMPTY },
      ]);

      expect(totals).toEqual({
        totalHours: 21.5,
        workingDays: 3,
        leaveDays: 1,
        holidayDays: 1,
        extendedDays: 1,
        weekendWorkDays: 1,
      });
    });

    it('returns zeroes for an untouched month', () => {
      const totals = computeTotals(
        Array.from({ length: 31 }, () => ({ hours: null, status: TimesheetEntryStatus.EMPTY }))
      );
      expect(totals.totalHours).toBe(0);
      expect(totals.workingDays).toBe(0);
    });
  });

  describe('getOrCreateForPeriod', () => {
    it('returns the existing sheet without creating another', async () => {
      repo.findByPeriod.mockResolvedValue(sheet());

      await service.getOrCreateForPeriod(EMPLOYEE, '2026-08', ORG_A, EMPLOYEE);

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('seeds a draft with one entry per calendar day', async () => {
      repo.findByPeriod.mockResolvedValue(null);
      repo.create.mockResolvedValue({ id: 'sheet-1' });
      repo.findById.mockResolvedValue(sheet());

      await service.getOrCreateForPeriod(EMPLOYEE, '2026-08', ORG_A, EMPLOYEE);

      const created = repo.createEntries.mock.calls[0][0];
      expect(created).toHaveLength(31);
      expect(created[0]).toMatchObject({ dayOfWeek: 'Saturday', status: TimesheetEntryStatus.EMPTY });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_A, userId: EMPLOYEE, period: '2026-08' }),
        expect.anything()
      );
    });
  });

  describe('multi-tenant isolation', () => {
    it('scopes every lookup by the caller organization', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getById('sheet-1', ORG_B)).rejects.toThrow('Timesheet not found');
      expect(repo.findById).toHaveBeenCalledWith('sheet-1', ORG_B);
    });

    it('does not reveal another tenant sheet through submit', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.submit('sheet-1', ORG_B, EMPLOYEE)).rejects.toThrow(
        'Timesheet not found'
      );
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('passes the caller organization through to list queries', async () => {
      repo.list.mockResolvedValue([]);

      await service.list(ORG_A, { employeeId: EMPLOYEE, year: 2026 });

      expect(repo.list).toHaveBeenCalledWith(ORG_A, {
        userId: EMPLOYEE,
        year: 2026,
        status: undefined,
      });
    });
  });

  describe('editing guards', () => {
    it('refuses an edit once the sheet is submitted', async () => {
      repo.findById.mockResolvedValue(sheet({ status: TimesheetStatus.SUBMITTED }));

      await expect(
        service.updateEntry('sheet-1', 'entry-1', { hours: 8 }, ORG_A, EMPLOYEE)
      ).rejects.toThrow(/locked for editing/);
    });

    it('refuses an edit from someone who does not own the sheet', async () => {
      repo.findById.mockResolvedValue(sheet());

      await expect(
        service.updateEntry('sheet-1', 'entry-1', { hours: 8 }, ORG_A, MANAGER)
      ).rejects.toThrow(/Only the owning employee/);
    });

    it('rejects bulk dates outside the period', async () => {
      repo.findById.mockResolvedValue(sheet());

      await expect(
        service.bulkUpsertEntries(
          'sheet-1',
          { entries: [{ date: '2026-09-01', hours: 8 }] },
          ORG_A,
          EMPLOYEE
        )
      ).rejects.toThrow(/outside period 2026-08/);
      expect(repo.upsertEntry).not.toHaveBeenCalled();
    });
  });

  describe('totalHours denormalization', () => {
    it('recalculates the parent total on every entry write', async () => {
      repo.findById.mockResolvedValue(sheet());
      repo.findEntry.mockResolvedValue(entry() as any);
      repo.sumHours.mockResolvedValue(new Prisma.Decimal(7.5));

      await service.updateEntry('sheet-1', 'entry-1', { hours: 7.5 }, ORG_A, EMPLOYEE);

      expect(repo.sumHours).toHaveBeenCalledWith('sheet-1', expect.anything());
      expect(repo.update).toHaveBeenCalledWith(
        'sheet-1',
        expect.objectContaining({ totalHours: new Prisma.Decimal(7.5) }),
        expect.anything()
      );
    });
  });

  describe('submit → approve', () => {
    it('marks the sheet submitted and stamps the time', async () => {
      repo.findById.mockResolvedValue(sheet());

      await service.submit('sheet-1', ORG_A, EMPLOYEE);

      expect(repo.update).toHaveBeenCalledWith(
        'sheet-1',
        expect.objectContaining({
          status: TimesheetStatus.SUBMITTED,
          submittedAt: expect.any(Date),
        }),
        expect.anything()
      );
    });

    it('refuses a submit from anyone but the owner', async () => {
      repo.findById.mockResolvedValue(sheet());

      await expect(service.submit('sheet-1', ORG_A, MANAGER)).rejects.toThrow(
        /Only the owning employee/
      );
    });

    it('records the approver on approval', async () => {
      repo.findById.mockResolvedValue(sheet({ status: TimesheetStatus.SUBMITTED }));

      await service.approve('sheet-1', ORG_A, MANAGER);

      expect(repo.update).toHaveBeenCalledWith(
        'sheet-1',
        expect.objectContaining({
          status: TimesheetStatus.APPROVED,
          approvedById: MANAGER,
          approvedAt: expect.any(Date),
        })
      );
    });

    it('will not approve twice', async () => {
      repo.findById.mockResolvedValue(sheet({ status: TimesheetStatus.APPROVED }));

      await expect(service.approve('sheet-1', ORG_A, MANAGER)).rejects.toThrow(/Cannot move/);
    });
  });

  describe('submit → reject → re-edit → resubmit', () => {
    it('stores the reason and clears any stale approval', async () => {
      repo.findById.mockResolvedValue(sheet({ status: TimesheetStatus.SUBMITTED }));

      await service.reject('sheet-1', { rejectionReason: 'Friday is missing' }, ORG_A, MANAGER);

      expect(repo.update).toHaveBeenCalledWith(
        'sheet-1',
        expect.objectContaining({
          status: TimesheetStatus.REJECTED,
          rejectionReason: 'Friday is missing',
          approvedById: null,
          approvedAt: null,
        })
      );
    });

    it('reopens editing after a rejection', async () => {
      repo.findById.mockResolvedValue(sheet({ status: TimesheetStatus.REJECTED }));
      repo.findEntry.mockResolvedValue(entry() as any);

      await expect(
        service.updateEntry('sheet-1', 'entry-1', { hours: 8 }, ORG_A, EMPLOYEE)
      ).resolves.toBeDefined();
    });

    it('clears the rejection when the sheet is resubmitted', async () => {
      repo.findById.mockResolvedValue(
        sheet({ status: TimesheetStatus.REJECTED, rejectionReason: 'Friday is missing' })
      );

      await service.submit('sheet-1', ORG_A, EMPLOYEE);

      expect(repo.update).toHaveBeenCalledWith(
        'sheet-1',
        expect.objectContaining({
          status: TimesheetStatus.SUBMITTED,
          rejectedAt: null,
          rejectionReason: null,
        }),
        expect.anything()
      );
    });
  });

  describe('summary', () => {
    it('rolls the year up across periods', async () => {
      repo.list.mockResolvedValue([
        sheet({
          period: '2026-07',
          status: TimesheetStatus.APPROVED,
          entries: [
            { hours: new Prisma.Decimal(8), status: TimesheetEntryStatus.WORKING },
            { hours: null, status: TimesheetEntryStatus.LEAVE },
          ],
        }),
        sheet({
          period: '2026-08',
          status: TimesheetStatus.DRAFT,
          entries: [{ hours: new Prisma.Decimal(6), status: TimesheetEntryStatus.WORKING }],
        }),
      ]);

      const summary = await service.summary(ORG_A, { year: 2026 }, EMPLOYEE);

      expect(summary.totalHours).toBe(14);
      expect(summary.workingDays).toBe(2);
      expect(summary.leaveDays).toBe(1);
      expect(summary.approvedPeriods).toBe(1);
      expect(summary.periods.map((p) => p.period)).toEqual(['2026-07', '2026-08']);
    });
  });
});
