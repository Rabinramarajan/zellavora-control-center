import { AccountStatus } from './account-status';
import type { RequestType } from '../user-requests/user-request.types';

/**
 * Users are read-only: every account or access change goes through a User Request
 * (request → approval → provisioning). The only direct actions left are emergency
 * responses (lock, revoke sessions) and messages that change no account data
 * (password-reset email, resend invitation). Each still requires users:manage,
 * a confirmation in the UI, and is audited.
 */
export type UserAction = 'lock' | 'sendPasswordReset' | 'resendInvitation' | 'revokeSessions';

interface AccountState {
  accountStatus: AccountStatus;
  mfaEnabled: boolean;
  activeSessions: number;
}

/** Pure: which direct (non-request) actions make sense for an account right now. */
export function allowedUserActions(state: AccountState, canManage: boolean): UserAction[] {
  if (!canManage) return [];
  const actions: UserAction[] = [];
  switch (state.accountStatus) {
    case 'INVITED':
    case 'PENDING_VERIFICATION':
      actions.push('resendInvitation');
      break;
    case 'ACTIVE':
      actions.push('sendPasswordReset', 'lock');
      break;
    case 'LOCKED':
      actions.push('sendPasswordReset');
      break;
  }
  if (state.activeSessions > 0) actions.push('revokeSessions');
  return actions;
}

/**
 * Pure: which User Request types can be raised for an account in its current state.
 * Impossible changes (activating an active user, resetting MFA that is not enrolled)
 * are never offered.
 */
export function requestableChanges(state: AccountState, canRequest: boolean): RequestType[] {
  if (!canRequest) return [];
  const access: RequestType[] = ['ADD_ROLE', 'REMOVE_ROLE', 'ADD_GROUP', 'REMOVE_GROUP'];
  const mfa: RequestType[] = state.mfaEnabled ? ['RESET_MFA'] : [];
  switch (state.accountStatus) {
    case 'INVITED':
    case 'PENDING_VERIFICATION':
      return ['UPDATE_USER', ...access, 'TRANSFER'];
    case 'ACTIVE':
      return ['UPDATE_USER', ...access, 'TRANSFER', 'DEACTIVATE_USER', ...mfa];
    case 'LOCKED':
      return ['UNLOCK_ACCOUNT', 'UPDATE_USER', ...mfa];
    case 'INACTIVE':
    case 'SUSPENDED':
      return ['ACTIVATE_USER', 'UPDATE_USER'];
    case 'DISABLED':
      return ['ACTIVATE_USER'];
  }
}
