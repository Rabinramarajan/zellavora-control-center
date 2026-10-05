import { ApprovalMode } from '@prisma/client';
import {
  assertCanMarkPaid,
  assertCanReopen,
  assertReviewAllowed,
  autoApproves,
} from './approval-mode.rules';

const OWNER = 'owner-1';
const REVIEWER = { userId: 'manager-1', canReview: true };
const OWNER_REVIEWER = { userId: OWNER, canReview: true };
const OWNER_ONLY = { userId: OWNER, canReview: false };
const sheet = { userId: OWNER };

describe('approval mode rules', () => {
  it('auto-approves only when approval is off', () => {
    expect(autoApproves(ApprovalMode.NONE)).toBe(true);
    expect(autoApproves(ApprovalMode.SELF)).toBe(false);
    expect(autoApproves(ApprovalMode.EXTERNAL)).toBe(false);
  });

  describe('assertReviewAllowed', () => {
    it('refuses every review when approval is off', () => {
      expect(() => assertReviewAllowed(ApprovalMode.NONE, sheet, REVIEWER)).toThrow(/turned off/);
    });

    it('allows a self review in SELF mode, given the permission', () => {
      expect(() => assertReviewAllowed(ApprovalMode.SELF, sheet, OWNER_REVIEWER)).not.toThrow();
      expect(() => assertReviewAllowed(ApprovalMode.SELF, sheet, OWNER_ONLY)).toThrow(/permission/);
    });

    it('refuses a self review under external approval', () => {
      expect(() => assertReviewAllowed(ApprovalMode.EXTERNAL, sheet, OWNER_REVIEWER)).toThrow(
        /your own sheet/
      );
      expect(() => assertReviewAllowed(ApprovalMode.EXTERNAL, sheet, REVIEWER)).not.toThrow();
    });
  });

  describe('assertCanMarkPaid', () => {
    it('lets the owner mark paid when approval is off', () => {
      expect(() => assertCanMarkPaid(ApprovalMode.NONE, sheet, OWNER_ONLY)).not.toThrow();
    });

    it('needs a reviewer other than the owner under external approval', () => {
      expect(() => assertCanMarkPaid(ApprovalMode.EXTERNAL, sheet, OWNER_REVIEWER)).toThrow();
      expect(() => assertCanMarkPaid(ApprovalMode.EXTERNAL, sheet, REVIEWER)).not.toThrow();
    });
  });

  describe('assertCanReopen', () => {
    const approved = { userId: OWNER, approved: true };

    it('lets the owner reopen an approved sheet in NONE and SELF modes', () => {
      expect(() => assertCanReopen(ApprovalMode.NONE, approved, OWNER)).not.toThrow();
      expect(() => assertCanReopen(ApprovalMode.SELF, approved, OWNER)).not.toThrow();
    });

    it('is not available under external approval', () => {
      expect(() => assertCanReopen(ApprovalMode.EXTERNAL, approved, OWNER)).toThrow(
        /reviewer rejecting/
      );
    });

    it('refuses other users, paid sheets and unapproved sheets', () => {
      expect(() => assertCanReopen(ApprovalMode.NONE, approved, 'someone-else')).toThrow(
        /Only the owner/
      );
      expect(() => assertCanReopen(ApprovalMode.NONE, { ...approved, paid: true }, OWNER)).toThrow(
        /Paid/
      );
      expect(() =>
        assertCanReopen(ApprovalMode.NONE, { userId: OWNER, approved: false }, OWNER)
      ).toThrow(/Only approved/);
    });
  });
});
