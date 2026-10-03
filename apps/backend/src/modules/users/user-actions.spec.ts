import { accountStatusOf } from './account-status';
import { parseUserNo } from './iam-user.repository';
import { formatUserCode } from './iam-user.mapper';
import { allowedUserActions, requestableChanges } from './user-actions';

const state = (
  accountStatus: Parameters<typeof allowedUserActions>[0]['accountStatus'],
  extra = {}
) => ({
  accountStatus,
  mfaEnabled: false,
  activeSessions: 0,
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

describe('allowedUserActions (direct actions)', () => {
  it('offers nothing without users:manage', () => {
    expect(allowedUserActions(state('ACTIVE', { activeSessions: 2 }), false)).toEqual([]);
  });

  it('keeps only emergency actions and messages direct', () => {
    expect(allowedUserActions(state('ACTIVE', { activeSessions: 1 }), true)).toEqual([
      'sendPasswordReset',
      'lock',
      'revokeSessions',
    ]);
    expect(allowedUserActions(state('INVITED'), true)).toEqual(['resendInvitation']);
  });

  it('never offers account or access changes directly', () => {
    for (const status of ['ACTIVE', 'LOCKED', 'INACTIVE', 'DISABLED'] as const) {
      const actions: string[] = allowedUserActions(state(status, { mfaEnabled: true }), true);
      for (const change of ['edit', 'activate', 'deactivate', 'unlock', 'resetMfa']) {
        expect(actions).not.toContain(change);
      }
    }
  });
});

describe('requestableChanges', () => {
  it('offers nothing without user-requests:create', () => {
    expect(requestableChanges(state('ACTIVE'), false)).toEqual([]);
  });

  it('matches each change to the account state', () => {
    expect(requestableChanges(state('LOCKED'), true)).toContain('UNLOCK_ACCOUNT');
    expect(requestableChanges(state('ACTIVE'), true)).not.toContain('UNLOCK_ACCOUNT');
    expect(requestableChanges(state('ACTIVE'), true)).toContain('DEACTIVATE_USER');
    expect(requestableChanges(state('INACTIVE'), true)).toContain('ACTIVATE_USER');
    expect(requestableChanges(state('DISABLED'), true)).toEqual(['ACTIVATE_USER']);
  });

  it('offers MFA reset only when MFA is enrolled', () => {
    expect(requestableChanges(state('ACTIVE'), true)).not.toContain('RESET_MFA');
    expect(requestableChanges(state('ACTIVE', { mfaEnabled: true }), true)).toContain('RESET_MFA');
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
