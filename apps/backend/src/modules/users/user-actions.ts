import { AccountStatus } from './account-status';

export type UserAction =
  | 'edit'
  | 'manageAccess'
  | 'activate'
  | 'deactivate'
  | 'disable'
  | 'lock'
  | 'unlock'
  | 'sendPasswordReset'
  | 'requirePasswordChange'
  | 'resendInvitation'
  | 'cancelInvitation'
  | 'resetMfa'
  | 'revokeSessions';

/**
 * Pure: which administrative actions make sense for an account in its current
 * state. Impossible actions (locking a locked user, resetting MFA that is not
 * enrolled) are never offered. `canManage` gates every mutating action.
 */
export function allowedUserActions(
  state: {
    accountStatus: AccountStatus;
    mfaEnabled: boolean;
    activeSessions: number;
    passwordResetRequired: boolean;
  },
  canManage: boolean
): UserAction[] {
  if (!canManage) return [];
  const actions: UserAction[] = [];
  switch (state.accountStatus) {
    case 'INVITED':
    case 'PENDING_VERIFICATION':
      actions.push('edit', 'manageAccess', 'resendInvitation', 'cancelInvitation');
      break;
    case 'ACTIVE':
      actions.push('edit', 'manageAccess', 'sendPasswordReset', 'lock', 'deactivate', 'disable');
      if (!state.passwordResetRequired) actions.push('requirePasswordChange');
      if (state.mfaEnabled) actions.push('resetMfa');
      break;
    case 'LOCKED':
      actions.push('unlock', 'sendPasswordReset');
      if (state.mfaEnabled) actions.push('resetMfa');
      break;
    case 'INACTIVE':
    case 'SUSPENDED':
      actions.push('edit', 'activate', 'disable');
      break;
    case 'DISABLED':
      actions.push('activate');
      break;
  }
  if (state.activeSessions > 0) actions.push('revokeSessions');
  return actions;
}
