import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/prisma';
import { DailySheetsService, computeAmounts, resolveHours } from './daily-sheets.service';
import { hoursBetween } from './sheets.shared';

jest.mock('../../infrastructure/prisma', () => ({
  prisma: {
    dailySheet: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    dailySheetLineItem: { deleteMany: jest.fn() },
    project: { findMany: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const db = prisma as unknown as {
  dailySheet: Record<'create' | 'update' | 'findFirst' | 'findMany' | 'count', jest.Mock>;
  dailySheetLineItem: { deleteMany: jest.Mock };
  project: { findMany: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
};

const ORG = 'org-1';
const OWNER = 'owner-1';
const MANAGER = 'manager-1';
const SELF = { userId: OWNER, canReview: false };
const REVIEWER = { userId: MANAGER, canReview: true };

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'sheet-1',
  organizationId: ORG,
  userId: OWNER,
  projectId: null,
  entryType: 'work',
  sheetDate: new Date('2026-09-25T00:00:00.000Z'),
  startTime: '09:00',
  endTime: '17:30',
  breakMinutes: 30,
  hoursWorked: new Prisma.Decimal(8),
  hourlyRate: new Prisma.Decimal(50),
  totalAmount: new Prisma.Decimal(400),
  isBillable: true,
  description: null,
  tasksCompleted: null,
  notes: null,
  status: 'draft',
  submittedAt: null,
  approvedBy: null,
  approvedAt: null,
  rejectionReason: null,
  createdBy: OWNER,
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  lineItems: [],
  user: { id: OWNER, fullName: 'Ada Lovelace', email: 'ada@example.com' },
  approver: null,
  ...overrides,
});

describe('daily sheet calculations', () => {
  describe('hoursBetween', () => {
    it('subtracts the break', () => {
      expect(hoursBetween('09:00', '17:30', 30)).toBe(8);
    });

    it('reads an earlier end time as an overnight shift', () => {
      expect(hoursBetween('22:00', '06:00', 0)).toBe(8);
    });
  });

  describe('resolveHours', () => {
    it('prefers the start/end span over typed hours', () => {
      expect(resolveHours({ startTime: '09:00', endTime: '13:00', hoursWorked: 7 })).toBe(4);
    });

    it('falls back to typed hours, then to the task total', () => {
      expect(resolveHours({ hoursWorked: 6.5 })).toBe(6.5);
      expect(
        resolveHours({
          lineItems: [
            { taskName: 'A', hours: 2 },
            { taskName: 'B', hours: 1.5 },
          ],
        })
      ).toBe(3.5);
    });

    it('refuses tasks that add up to more than the day', () => {
      expect(() =>
        resolveHours({ hoursWorked: 4, lineItems: [{ taskName: 'A', hours: 5 }] })
      ).toThrow(/more than the 4h worked/);
    });

    it('refuses a break that swallows the whole span', () => {
      expect(() =>
        resolveHours({ startTime: '09:00', endTime: '10:00', breakMinutes: 60 })
      ).toThrow(/break/);
    });

    it('refuses a day with no hours at all', () => {
      expect(() => resolveHours({})).toThrow(/between 0 and 24/);
    });
  });

  describe('computeAmounts', () => {
    it('bills unassigned hours at the sheet rate and tasks at their own', () => {
      const { totalAmount, items } = computeAmounts(8, 50, true, [
        { taskName: 'Audit', hours: 2, rate: 80 },
      ]);
      expect(items[0].amount).toBe(160);
      expect(totalAmount).toBe(160 + 6 * 50);
    });

    it('is worth nothing when not billable', () => {
      expect(computeAmounts(8, 50, false, []).totalAmount).toBe(0);
    });
  });
});

describe('DailySheetsService', () => {
  let service: DailySheetsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DailySheetsService();
    db.project.findMany.mockResolvedValue([]);
    db.dailySheet.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  });

  describe('create', () => {
    it('creates a draft for the caller with derived hours and amount', async () => {
      db.dailySheet.create.mockResolvedValue(record());

      await service.create(
        {
          sheetDate: '2026-09-25',
          startTime: '09:00',
          endTime: '17:30',
          breakMinutes: 30,
          hourlyRate: 50,
        },
        ORG,
        SELF
      );

      const { data } = db.dailySheet.create.mock.calls[0][0];
      expect(data).toMatchObject({ organizationId: ORG, userId: OWNER, status: 'draft' });
      expect(Number(data.hoursWorked)).toBe(8);
      expect(Number(data.totalAmount)).toBe(400);
    });

    it("refuses to create on someone else's behalf without the review permission", async () => {
      await expect(
        service.create(
          { userId: MANAGER, sheetDate: '2026-09-25', hoursWorked: 8, hourlyRate: 50 },
          ORG,
          SELF
        )
      ).rejects.toThrow(/permission/);
      expect(db.dailySheet.create).not.toHaveBeenCalled();
    });

    it('refuses a project from another organization', async () => {
      db.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            sheetDate: '2026-09-25',
            hoursWorked: 8,
            hourlyRate: 50,
            projectId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          },
          ORG,
          SELF
        )
      ).rejects.toThrow('Project not found');
    });

    it('returns numbers, not Decimal strings', async () => {
      db.dailySheet.create.mockResolvedValue(record());

      const view = await service.create(
        { sheetDate: '2026-09-25', hoursWorked: 8, hourlyRate: 50 },
        ORG,
        SELF
      );

      expect(view.hoursWorked).toBe(8);
      expect(view.totalAmount).toBe(400);
      expect(view.sheetDate).toBe('2026-09-25');
    });
  });

  describe('leave and holiday days', () => {
    it('records a leave day with no hours, times or amount', async () => {
      db.dailySheet.create.mockResolvedValue(record({ entryType: 'leave' }));

      await service.create(
        {
          sheetDate: '2026-08-06',
          entryType: 'leave',
          startTime: '09:00',
          endTime: '17:00',
          hourlyRate: 50,
        },
        ORG,
        SELF
      );

      const { data } = db.dailySheet.create.mock.calls[0][0];
      expect(data).toMatchObject({
        entryType: 'leave',
        startTime: null,
        endTime: null,
        isBillable: false,
      });
      expect(Number(data.hoursWorked)).toBe(0);
      expect(Number(data.totalAmount)).toBe(0);
    });

    it('refuses leave on a day that already has work logged', async () => {
      db.dailySheet.findMany.mockResolvedValue([{ entryType: 'work' }]);

      await expect(
        service.create({ sheetDate: '2026-08-06', entryType: 'leave' }, ORG, SELF)
      ).rejects.toMatchObject({ status: 409, code: 'DAY_ALREADY_LOGGED' });
    });

    it('refuses work on a day recorded as leave', async () => {
      db.dailySheet.findMany.mockResolvedValue([{ entryType: 'leave' }]);

      await expect(
        service.create({ sheetDate: '2026-08-06', hoursWorked: 8, hourlyRate: 50 }, ORG, SELF)
      ).rejects.toMatchObject({ status: 409, code: 'DAY_IS_ABSENCE' });
    });

    it('allows several work entries on the same day', async () => {
      db.dailySheet.findMany.mockResolvedValue([{ entryType: 'work' }]);
      db.dailySheet.create.mockResolvedValue(record());

      await expect(
        service.create({ sheetDate: '2026-08-06', hoursWorked: 2, hourlyRate: 50 }, ORG, SELF)
      ).resolves.toBeDefined();
    });

    it('drops the tasks when a work day is changed to leave', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record());
      db.dailySheet.update.mockResolvedValue(record({ entryType: 'leave' }));

      await service.update('sheet-1', { entryType: 'leave' }, ORG, SELF);

      expect(db.dailySheetLineItem.deleteMany).toHaveBeenCalled();
      expect(Number(db.dailySheet.update.mock.calls[0][0].data.hoursWorked)).toBe(0);
    });
  });

  describe('update', () => {
    it('locks a submitted sheet', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ status: 'submitted' }));

      await expect(service.update('sheet-1', { notes: 'x' }, ORG, SELF)).rejects.toThrow(/locked/);
    });

    it('refuses anyone but the owner', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record());

      await expect(service.update('sheet-1', { notes: 'x' }, ORG, REVIEWER)).rejects.toThrow(
        /Only the owner/
      );
    });

    it('returns an edited rejected sheet to draft and recomputes hours', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ status: 'rejected' }));
      db.dailySheet.update.mockResolvedValue(record());

      await service.update('sheet-1', { endTime: '13:30' }, ORG, SELF);

      const { data } = db.dailySheet.update.mock.calls[0][0];
      expect(data.status).toBe('draft');
      expect(Number(data.hoursWorked)).toBe(4);
    });
  });

  describe('review', () => {
    it('lets a reviewer approve a submitted sheet', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ status: 'submitted' }));
      db.dailySheet.update.mockResolvedValue(record({ status: 'approved' }));

      await service.approve('sheet-1', { approved: true }, ORG, REVIEWER);

      expect(db.dailySheet.update.mock.calls[0][0].data).toMatchObject({
        status: 'approved',
        approvedBy: MANAGER,
      });
    });

    it('stores the reason and clears any approval on reject', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ status: 'submitted' }));
      db.dailySheet.update.mockResolvedValue(record({ status: 'rejected' }));

      await service.approve(
        'sheet-1',
        { approved: false, rejectionReason: 'Wrong project' },
        ORG,
        REVIEWER
      );

      expect(db.dailySheet.update.mock.calls[0][0].data).toMatchObject({
        status: 'rejected',
        rejectionReason: 'Wrong project',
        approvedBy: null,
      });
    });

    it('refuses a self review', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ status: 'submitted', userId: MANAGER }));

      await expect(service.approve('sheet-1', { approved: true }, ORG, REVIEWER)).rejects.toThrow(
        /your own sheet/
      );
    });

    it('refuses to review a sheet that was never submitted', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ status: 'draft' }));

      await expect(service.approve('sheet-1', { approved: true }, ORG, REVIEWER)).rejects.toThrow(
        /Only submitted/
      );
    });
  });

  describe('visibility', () => {
    it('hides a colleague sheet behind a 404', async () => {
      db.dailySheet.findFirst.mockResolvedValue(record({ userId: MANAGER }));

      await expect(service.getById('sheet-1', ORG, SELF)).rejects.toThrow('Sheet not found');
    });

    it('scopes every lookup to the organization and skips deleted rows', async () => {
      db.dailySheet.findFirst.mockResolvedValue(null);

      await expect(service.getById('sheet-1', 'other-org', SELF)).rejects.toThrow(
        'Sheet not found'
      );
      expect(db.dailySheet.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sheet-1', organizationId: 'other-org', deletedAt: null },
        })
      );
    });

    it('pins a non-reviewer list to their own sheets', async () => {
      db.dailySheet.findMany.mockResolvedValue([]);
      db.dailySheet.count.mockResolvedValue(0);

      await service.list(ORG, { scope: 'mine', page: 1, pageSize: 50 }, SELF);

      expect(db.dailySheet.findMany.mock.calls[0][0].where).toMatchObject({ userId: OWNER });
    });

    it('refuses the team view without the review permission', async () => {
      await expect(
        service.list(ORG, { scope: 'team', page: 1, pageSize: 50 }, SELF)
      ).rejects.toThrow(/permission/);
    });

    it('lets a reviewer list the whole team', async () => {
      db.dailySheet.findMany.mockResolvedValue([record()]);
      db.dailySheet.count.mockResolvedValue(1);

      const result = await service.list(
        ORG,
        { scope: 'team', status: 'submitted', page: 1, pageSize: 50 },
        REVIEWER
      );

      expect(db.dailySheet.findMany.mock.calls[0][0].where).not.toHaveProperty('userId');
      expect(result.total).toBe(1);
    });
  });

  it('soft-deletes a draft', async () => {
    db.dailySheet.findFirst.mockResolvedValue(record());
    db.dailySheet.update.mockResolvedValue(record());

    await service.delete('sheet-1', ORG, SELF);

    expect(db.dailySheet.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });
});
