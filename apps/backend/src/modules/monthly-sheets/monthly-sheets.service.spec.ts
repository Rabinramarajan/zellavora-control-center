import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { MonthlySheetsService, rollUpMonth } from './monthly-sheets.service';

jest.mock('../../infrastructure/prisma', () => ({
  prisma: {
    monthlySheet: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    dailySheet: { findMany: jest.fn() },
  },
}));

const db = prisma as unknown as {
  monthlySheet: Record<'create' | 'update' | 'findFirst' | 'findMany' | 'count', jest.Mock>;
  dailySheet: { findMany: jest.Mock };
};

const ORG = 'org-1';
const OWNER = 'owner-1';
const MANAGER = 'manager-1';
const SELF = { userId: OWNER, canReview: false };
const REVIEWER = { userId: MANAGER, canReview: true };

const daily = (date: string, hours: number, amount: number, isBillable = true) => ({
  id: `daily-${date}-${hours}`,
  sheetDate: new Date(`${date}T00:00:00.000Z`),
  hoursWorked: new Prisma.Decimal(hours),
  totalAmount: new Prisma.Decimal(amount),
  isBillable,
});

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'month-1',
  organizationId: ORG,
  userId: OWNER,
  projectId: null,
  month: 9,
  year: 2026,
  totalHours: new Prisma.Decimal(16),
  totalAmount: new Prisma.Decimal(800),
  averageHourlyRate: new Prisma.Decimal(50),
  workingDays: 2,
  status: 'draft',
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  paidAt: null,
  rejectionReason: null,
  dailySheetIds: ['daily-1', 'daily-2'],
  createdBy: OWNER,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  user: { id: OWNER, fullName: 'Ada Lovelace', email: 'ada@example.com' },
  approver: null,
  ...overrides,
});

describe('rollUpMonth', () => {
  it('sums hours and amounts and counts distinct days', () => {
    const totals = rollUpMonth([
      daily('2026-09-01', 4, 200),
      daily('2026-09-01', 4, 240),
      daily('2026-09-02', 8, 400),
    ]);
    expect(totals).toEqual({
      totalHours: 16,
      billableHours: 16,
      totalAmount: 840,
      averageHourlyRate: 52.5,
      workingDays: 2,
    });
  });

  it('averages the rate over billable hours only', () => {
    const totals = rollUpMonth([daily('2026-09-01', 8, 400), daily('2026-09-02', 8, 0, false)]);
    expect(totals.totalHours).toBe(16);
    expect(totals.billableHours).toBe(8);
    expect(totals.averageHourlyRate).toBe(50);
  });

  it('is all zeroes for an empty month', () => {
    expect(rollUpMonth([]).averageHourlyRate).toBe(0);
  });
});

describe('MonthlySheetsService', () => {
  let service: MonthlySheetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MonthlySheetsService();
    db.dailySheet.findMany.mockResolvedValue([]);
  });

  describe('create', () => {
    it("generates the month from the caller's approved daily sheets", async () => {
      db.monthlySheet.findFirst.mockResolvedValue(null);
      db.dailySheet.findMany.mockResolvedValueOnce([
        daily('2026-09-01', 8, 400),
        daily('2026-09-02', 8, 400),
      ]);
      db.monthlySheet.create.mockResolvedValue(record());

      await service.create({ month: 9, year: 2026 }, ORG, SELF);

      const query = db.dailySheet.findMany.mock.calls[0][0];
      expect(query.where).toMatchObject({
        organizationId: ORG,
        userId: OWNER,
        status: 'approved',
        deletedAt: null,
      });
      expect(query.where.sheetDate.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(query.where.sheetDate.lte.toISOString()).toBe('2026-09-30T00:00:00.000Z');

      const { data } = db.monthlySheet.create.mock.calls[0][0];
      expect(Number(data.totalHours)).toBe(16);
      expect(data.workingDays).toBe(2);
      expect(data.status).toBe('draft');
    });

    it('reports a conflict when the month already exists', async () => {
      db.monthlySheet.findFirst.mockResolvedValue({ id: 'month-1', deletedAt: null });

      await expect(service.create({ month: 9, year: 2026 }, ORG, SELF)).rejects.toMatchObject({
        status: 409,
        code: 'MONTHLY_SHEET_EXISTS',
      });
      expect(db.monthlySheet.create).not.toHaveBeenCalled();
    });

    it('revives a deleted month instead of tripping the unique key', async () => {
      db.monthlySheet.findFirst.mockResolvedValue({ id: 'month-1', deletedAt: new Date() });
      db.monthlySheet.update.mockResolvedValue(record());

      await service.create({ month: 9, year: 2026 }, ORG, SELF);

      expect(db.monthlySheet.create).not.toHaveBeenCalled();
      expect(db.monthlySheet.update.mock.calls[0][0].data).toMatchObject({
        deletedAt: null,
        status: 'draft',
      });
    });

    it("refuses to generate someone else's month without the review permission", async () => {
      await expect(
        service.create({ month: 9, year: 2026, userId: MANAGER }, ORG, SELF)
      ).rejects.toThrow(/permission/);
    });
  });

  describe('workflow', () => {
    it('will not submit a month with nothing in it', async () => {
      db.monthlySheet.findFirst.mockResolvedValue(record({ dailySheetIds: [] }));

      await expect(service.submitForApproval('month-1', ORG, SELF)).rejects.toThrow(
        /no approved daily/
      );
    });

    it('submits a draft', async () => {
      db.monthlySheet.findFirst.mockResolvedValue(record());
      db.monthlySheet.update.mockResolvedValue(record({ status: 'submitted' }));

      await service.submitForApproval('month-1', ORG, SELF);

      expect(db.monthlySheet.update.mock.calls[0][0].data).toMatchObject({ status: 'submitted' });
    });

    it('lets a reviewer approve and then mark paid', async () => {
      db.monthlySheet.findFirst.mockResolvedValueOnce(record({ status: 'submitted' }));
      db.monthlySheet.update.mockResolvedValue(record({ status: 'approved' }));
      await service.approve('month-1', { approved: true }, ORG, REVIEWER);

      db.monthlySheet.findFirst.mockResolvedValueOnce(record({ status: 'approved' }));
      await service.markAsPaid('month-1', {}, ORG, REVIEWER);

      expect(db.monthlySheet.update.mock.calls[1][0].data).toMatchObject({ status: 'paid' });
    });

    it('will not pay a sheet that is not approved', async () => {
      db.monthlySheet.findFirst.mockResolvedValue(record({ status: 'submitted' }));

      await expect(service.markAsPaid('month-1', {}, ORG, REVIEWER)).rejects.toThrow(/approved/);
    });

    it('refuses a self review', async () => {
      db.monthlySheet.findFirst.mockResolvedValue(record({ status: 'submitted', userId: MANAGER }));

      await expect(service.approve('month-1', { approved: true }, ORG, REVIEWER)).rejects.toThrow(
        /your own sheet/
      );
    });

    it('regenerating a rejected month returns it to draft', async () => {
      db.monthlySheet.findFirst.mockResolvedValue(record({ status: 'rejected' }));
      db.monthlySheet.update.mockResolvedValue(record());

      await service.regenerate('month-1', ORG, SELF);

      expect(db.monthlySheet.update.mock.calls[0][0].data.status).toBe('draft');
    });
  });

  it('returns numbers, not Decimal strings', async () => {
    db.monthlySheet.findFirst.mockResolvedValue(record());
    db.dailySheet.findMany.mockResolvedValue([
      { id: 'daily-1', hoursWorked: new Prisma.Decimal(8) },
    ]);

    const view = await service.getById('month-1', ORG, SELF);

    expect(view.totalHours).toBe(16);
    expect(view.totalAmount).toBe(800);
    expect(view.billableHours).toBe(8);
    expect(view.totalSheets).toBe(2);
  });
});
