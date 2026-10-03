import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserAdminApiService } from '../../core/api/user-admin.api';
import { AccountStatus } from '../../shared/models/iam.model';
import { RequestChangeType, UserAction } from '../../shared/models/user-admin.model';
import { IamDialogsService } from '../iam/shared/iam-dialogs.service';
import { IamFeedbackService } from '../iam/shared/iam-feedback.service';

export type { RequestChangeType };

export interface ActionMeta {
  label: string;
  icon: string;
  danger?: boolean;
}

/**
 * Users are read-only. Only emergency responses (lock, revoke sessions) and messages
 * (password reset, resend invitation) are direct; every other change is a User Request.
 */
export const ACTION_META: Record<UserAction, ActionMeta> = {
  lock: { label: 'Lock Account', icon: 'pi pi-lock', danger: true },
  sendPasswordReset: { label: 'Send Password Reset', icon: 'pi pi-envelope' },
  resendInvitation: { label: 'Resend Invitation', icon: 'pi pi-send' },
  revokeSessions: { label: 'Revoke Sessions', icon: 'pi pi-sign-out', danger: true },
};

/** Labels for the Request Change menu; each opens a prefilled User Request. */
export const REQUEST_CHANGE_META: Record<RequestChangeType, ActionMeta> = {
  UPDATE_USER: { label: 'Update User Details', icon: 'pi pi-user-edit' },
  ADD_ROLE: { label: 'Add Role', icon: 'pi pi-plus-circle' },
  REMOVE_ROLE: { label: 'Remove Role', icon: 'pi pi-minus-circle' },
  ADD_GROUP: { label: 'Add Group', icon: 'pi pi-users' },
  REMOVE_GROUP: { label: 'Remove Group', icon: 'pi pi-user-minus' },
  TRANSFER: { label: 'Branch / Team Transfer', icon: 'pi pi-arrow-right-arrow-left' },
  ACTIVATE_USER: { label: 'Activate Account', icon: 'pi pi-check-circle' },
  DEACTIVATE_USER: { label: 'Deactivate Account', icon: 'pi pi-ban' },
  UNLOCK_ACCOUNT: { label: 'Unlock Account', icon: 'pi pi-lock-open' },
  RESET_MFA: { label: 'Reset MFA', icon: 'pi pi-shield' },
};

interface RowState {
  accountStatus: AccountStatus;
  mfaEnabled: boolean;
}

/**
 * Mirrors the backend rules (users/user-actions.ts) for list rows, where the session
 * count is unknown; the detail page uses the server's lists instead.
 */
export function rowActions(user: RowState, canManage: boolean): UserAction[] {
  if (!canManage) return [];
  switch (user.accountStatus) {
    case 'INVITED':
    case 'PENDING_VERIFICATION':
      return ['resendInvitation'];
    case 'ACTIVE':
      return ['sendPasswordReset', 'lock', 'revokeSessions'];
    case 'LOCKED':
      return ['sendPasswordReset', 'revokeSessions'];
    default:
      return [];
  }
}

/** Mirrors the backend `requestableChanges` for list rows. */
export function rowChanges(user: RowState, canRequest: boolean): RequestChangeType[] {
  if (!canRequest) return [];
  const access: RequestChangeType[] = ['ADD_ROLE', 'REMOVE_ROLE', 'ADD_GROUP', 'REMOVE_GROUP'];
  const mfa: RequestChangeType[] = user.mfaEnabled ? ['RESET_MFA'] : [];
  switch (user.accountStatus) {
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

/** Every direct action changes state, so all of them are runnable here. */
export type StateAction = UserAction;

interface Subject {
  id: string;
  fullName: string;
}

/**
 * Runs a direct action with the right confirmation: emergency actions ask for
 * confirmation (and a reason where it is recorded), then call the API, which audits it.
 * Resolves true when the action was carried out.
 */
@Injectable({ providedIn: 'root' })
export class UserActionsService {
  private readonly api = inject(UserAdminApiService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);

  async run(action: StateAction, user: Subject): Promise<boolean> {
    const name = user.fullName;
    switch (action) {
      case 'lock':
        return this.withReason(
          `Lock ${name}?`,
          'Emergency action: they are signed out and cannot sign in until an approved unlock request.',
          'Lock',
          (reason) => firstValueFrom(this.api.lock(user.id, reason)),
          `${name} is locked.`
        );
      case 'sendPasswordReset':
        return this.confirmed(
          `Send a password reset to ${name}?`,
          'They receive a single-use link by email.',
          'Send',
          false,
          () => firstValueFrom(this.api.securityAction(user.id, 'password-reset')),
          'Password reset email sent.'
        );
      case 'resendInvitation':
        return this.confirmed(
          `Resend the invitation to ${name}?`,
          'Earlier invitation links stop working.',
          'Resend',
          false,
          () => firstValueFrom(this.api.securityAction(user.id, 'resend-invitation')),
          'Invitation sent.'
        );
      case 'revokeSessions':
        return this.confirmed(
          `Revoke all sessions for ${name}?`,
          'Emergency action: they are signed out on every device.',
          'Revoke',
          true,
          () => firstValueFrom(this.api.revokeAllSessions(user.id)),
          'Sessions revoked.'
        );
    }
  }

  private async confirmed(
    title: string,
    message: string,
    confirmText: string,
    danger: boolean,
    call: () => Promise<unknown>,
    success: string
  ): Promise<boolean> {
    if (!(await this.dialogs.confirm(title, message, confirmText, danger))) return false;
    try {
      await call();
      this.feedback.success(success);
      return true;
    } catch (err) {
      this.feedback.error(err);
      return false;
    }
  }

  private async withReason(
    title: string,
    description: string,
    submitText: string,
    call: (reason: string | null) => Promise<unknown>,
    success: string
  ): Promise<boolean> {
    const values = await this.dialogs.form({
      title,
      description,
      submitText,
      variant: 'danger',
      fields: [{ key: 'reason', label: 'Reason', type: 'textarea', maxLength: 500 }],
      submit: (v) => call(String(v['reason'] ?? '').trim() || null),
    });
    if (!values) return false;
    this.feedback.success(success);
    return true;
  }
}
