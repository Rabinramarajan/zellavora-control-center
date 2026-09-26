import { TimesheetStatus, TimesheetEntryStatus } from '@prisma/client';
import {
  assertCanQueryEmployee,
  assertCanView,
  assertEntriesEditable,
  assertNotOwnSheet,
  assertTransition,
  canTransition,
  isEditableStatus,
  normalizeEntry,
} from './timesheets.rules';

const OWNER = 'user-1';

describe('timesheet rules', () => {
  describe('assertCanView', () => {
    it('lets the owner see their own sheet', () => {
      expect(() =>
        assertCanView({ userId: OWNER }, { userId: OWNER, canReview: false })
      ).not.toThrow();
    });

    it('lets a reviewer see anyone', () => {
      expect(() =>
        assertCanView({ userId: OWNER }, { userId: 'manager', canReview: true })
      ).not.toThrow();
    });

    it('hides a colleague sheet behind a 404', () => {
      expect(() => assertCanView({ userId: OWNER }, { userId: 'peer', canReview: false })).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('assertCanQueryEmployee', () => {
    it('allows an unfiltered or self query', () => {
      const viewer = { userId: OWNER, canReview: false };
      expect(() => assertCanQueryEmployee(undefined, viewer)).not.toThrow();
      expect(() => assertCanQueryEmployee(OWNER, viewer)).not.toThrow();
    });

    it('refuses a non-reviewer asking about someone else', () => {
      expect(() => assertCanQueryEmployee('peer', { userId: OWNER, canReview: false })).toThrow(
        /permission/
      );
    });

    it('allows a reviewer to ask about anyone', () => {
      expect(() =>
        assertCanQueryEmployee('peer', { userId: OWNER, canReview: true })
      ).not.toThrow();
    });
  });

  describe('assertNotOwnSheet', () => {
    it('refuses a self review', () => {
      expect(() => assertNotOwnSheet({ userId: OWNER }, OWNER)).toThrow(/your own timesheet/);
    });

    it('allows reviewing someone else', () => {
      expect(() => assertNotOwnSheet({ userId: OWNER }, 'manager')).not.toThrow();
    });
  });

  describe('assertEntriesEditable', () => {
    it.each([TimesheetStatus.DRAFT, TimesheetStatus.REJECTED])(
      'lets the owner edit a %s sheet',
      (status) => {
        expect(() => assertEntriesEditable({ userId: OWNER, status }, OWNER)).not.toThrow();
      }
    );

    it.each([TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED])(
      'locks a %s sheet even for the owner',
      (status) => {
        expect(() => assertEntriesEditable({ userId: OWNER, status }, OWNER)).toThrow(
          /locked for editing/
        );
      }
    );

    it('refuses anyone other than the owner', () => {
      expect(() =>
        assertEntriesEditable({ userId: OWNER, status: TimesheetStatus.DRAFT }, 'someone-else')
      ).toThrow(/Only the owning employee/);
    });

    it('checks ownership before the status', () => {
      // A manager must not learn the sheet's state by probing this endpoint.
      expect(() =>
        assertEntriesEditable({ userId: OWNER, status: TimesheetStatus.APPROVED }, 'manager')
      ).toThrow(/Only the owning employee/);
    });
  });

  describe('status transitions', () => {
    it('allows draft to submitted', () => {
      expect(canTransition(TimesheetStatus.DRAFT, TimesheetStatus.SUBMITTED)).toBe(true);
    });

    it('allows a rejected sheet to be resubmitted', () => {
      expect(canTransition(TimesheetStatus.REJECTED, TimesheetStatus.SUBMITTED)).toBe(true);
    });

    it('allows a submitted sheet to be approved or rejected', () => {
      expect(canTransition(TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED)).toBe(true);
      expect(canTransition(TimesheetStatus.SUBMITTED, TimesheetStatus.REJECTED)).toBe(true);
    });

    it('treats approval as final', () => {
      expect(canTransition(TimesheetStatus.APPROVED, TimesheetStatus.REJECTED)).toBe(false);
      expect(canTransition(TimesheetStatus.APPROVED, TimesheetStatus.SUBMITTED)).toBe(false);
      expect(() => assertTransition(TimesheetStatus.APPROVED, TimesheetStatus.SUBMITTED)).toThrow(
        /Cannot move a timesheet from approved/
      );
    });

    it('will not approve a sheet that was never submitted', () => {
      expect(() => assertTransition(TimesheetStatus.DRAFT, TimesheetStatus.APPROVED)).toThrow(
        /Cannot move/
      );
    });

    it('agrees with isEditableStatus', () => {
      expect(isEditableStatus(TimesheetStatus.DRAFT)).toBe(true);
      expect(isEditableStatus(TimesheetStatus.APPROVED)).toBe(false);
    });
  });

  describe('normalizeEntry', () => {
    const working = { status: TimesheetEntryStatus.WORKING, hours: 8 };

    it('keeps valid hours', () => {
      expect(normalizeEntry(working, { hours: 7.5 })).toMatchObject({ hours: 7.5 });
    });

    it.each([-1, 24.5, 100])('rejects %s hours', (hours) => {
      expect(() => normalizeEntry(working, { hours })).toThrow(/between 0 and 24/);
    });

    it('accepts the boundaries', () => {
      expect(() => normalizeEntry(working, { hours: 0 })).not.toThrow();
      expect(() => normalizeEntry(working, { hours: 24 })).not.toThrow();
    });

    it.each([TimesheetEntryStatus.LEAVE, TimesheetEntryStatus.HOLIDAY])(
      'clears hours and times for %s',
      (status) => {
        expect(normalizeEntry(working, { status, hours: 8, startTime: '09:00' })).toMatchObject({
          status,
          hours: null,
          startTime: null,
          endTime: null,
        });
      }
    );

    it('validates hours against the status already on the row', () => {
      // No status in the patch, so the stored LEAVE status still wins.
      expect(
        normalizeEntry({ status: TimesheetEntryStatus.LEAVE, hours: null }, { hours: 8 })
      ).toMatchObject({ hours: null });
    });

    it('re-validates hours carried over from the row when only the status changes', () => {
      expect(() =>
        normalizeEntry(
          { status: TimesheetEntryStatus.LEAVE, hours: 30 },
          { status: TimesheetEntryStatus.WORKING }
        )
      ).toThrow(/between 0 and 24/);
    });
  });
});
