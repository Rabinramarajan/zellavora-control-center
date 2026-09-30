import { accountStatusOf } from './account-status';
import { parseUserNo } from './iam-user.repository';
import { formatUserCode } from './iam-user.mapper';
import { allowedUserActions } from './user-actions';

const state = (
  accountStatus: Parameters<typeof allowedUserActions>[0]['accountStatus'],
  extra = {}
) => ({
  accountStatus,
  mfaEnabled: false,
  activeSessions: 0,
  passwordResetRequired: false,
  ...extra,
});

describe('accountStatusOf', () => {
  it('splits PENDING into Invited and Pending Verification', () => {
    expect(accountStatusOf({ status: 'PENDING', passwordHash: null })).toBe('INVITED');
    expect(accountStatusOf({ status: 'PENDING', passwordHash: 'hash' })).toBe(
      'PENDING_VERIFICATION'
    );
  });

  it('treats a locked active account as Locked', () => {
    expect(accountStatusOf({ status: 'ACTIVE', isAccountLocked: true })).toBe('LOCKED');
    expect(accountStatusOf({ status: 'ACTIVE', isAccountLocked: false })).toBe('ACTIVE');
    expect(accountStatusOf({ status: 'DISABLED' })).toBe('DISABLED');
  });
});

describe('allowedUserActions', () => {
  it('offers nothing without users:manage', () => {
    expect(allowedUserActions(state('ACTIVE', { activeSessions: 2 }), false)).toEqual([]);
  });

  it('offers invitation actions only to invited users', () => {
    const actions = allowedUserActions(state('INVITED'), true);
    expect(actions).toEqual(expect.arrayContaining(['resendInvitation', 'cancelInvitation']));
    expect(actions).not.toContain('lock');
    expect(actions).not.toContain('sendPasswordReset');
  });

  it('never offers impossible actions', () => {
    const locked = allowedUserActions(state('LOCKED'), true);
    expect(locked).toContain('unlock');
    expect(locked).not.toContain('lock');

    const active = allowedUserActions(state('ACTIVE'), true);
    expect(active).toContain('lock');
    expect(active).not.toContain('unlock');
    expect(active).not.toContain('resetMfa');
    expect(active).not.toContain('revokeSessions');
    expect(active).not.toContain('activate');
  });

  it('adds MFA reset and session revocation only when there is something to reset', () => {
    const actions = allowedUserActions(
      state('ACTIVE', { mfaEnabled: true, activeSessions: 1 }),
      true
    );
    expect(actions).toEqual(expect.arrayContaining(['resetMfa', 'revokeSessions']));
  });

  it('lets inactive and disabled accounts be activated', () => {
    expect(allowedUserActions(state('INACTIVE'), true)).toContain('activate');
    expect(allowedUserActions(state('DISABLED'), true)).toEqual(['activate']);
  });

  it('hides Require Password Change once it is already required', () => {
    expect(
      allowedUserActions(state('ACTIVE', { passwordResetRequired: true }), true)
    ).not.toContain('requirePasswordChange');
  });
});

describe('user codes', () => {
  it('formats and parses USR numbers', () => {
    expect(formatUserCode(236)).toBe('USR000236');
    expect(parseUserNo('USR000236')).toBe(236);
    expect(parseUserNo('usr236')).toBe(236);
    expect(parseUserNo('236')).toBe(236);
    expect(parseUserNo('eric')).toBeNull();
  });
});
