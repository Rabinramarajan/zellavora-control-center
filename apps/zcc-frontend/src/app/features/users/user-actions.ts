import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserAdminApiService } from '@core/api/user-admin.api';
import { AccountStatus } from '@shared/models/iam.model';
import { UserAction } from '@shared/models/user-admin.model';
import { IamDialogsService } from '../iam/shared/iam-dialogs.service';
import { IamFeedbackService } from '../iam/shared/iam-feedback.service';

export interface ActionMeta {
  label: string;
  icon: string;
  danger?: boolean;
}

export const ACTION_META: Record<UserAction, ActionMeta> = {
  edit: { label: 'Edit User', icon: 'pi pi-pencil' },
  manageAccess: { label: 'Manage Access', icon: 'pi pi-key' },
  activate: { label: 'Activate', icon: 'pi pi-check-circle' },
  deactivate: { label: 'Deactivate', icon: 'pi pi-minus-circle', danger: true },
  disable: { label: 'Disable', icon: 'pi pi-ban', danger: true },
  lock: { label: 'Lock Account', icon: 'pi pi-lock', danger: true },
  unlock: { label: 'Unlock Account', icon: 'pi pi-lock-open' },
  sendPasswordReset: { label: 'Send Password Reset', icon: 'pi pi-envelope' },
  requirePasswordChange: { label: 'Require Password Change', icon: 'pi pi-key' },
  resendInvitation: { label: 'Resend Invitation', icon: 'pi pi-send' },
  cancelInvitation: { label: 'Cancel Invitation', icon: 'pi pi-times-circle', danger: true },
  resetMfa: { label: 'Reset MFA', icon: 'pi pi-shield', danger: true },
  revokeSessions: { label: 'Revoke Sessions', icon: 'pi pi-sign-out', danger: true },
};

/**
 * Mirrors the backend rules (user-actions.ts) for list rows, where the session
 * count is unknown; the detail page uses the server's list instead.
 */
export function rowActions(
  user: { accountStatus: AccountStatus; mfaEnabled: boolean },
  canManage: boolean
): UserAction[] {
  if (!canManage) return [];
  switch (user.accountStatus) {
    case 'INVITED':
    case 'PENDING_VERIFICATION':
      return ['edit', 'manageAccess', 'resendInvitation', 'cancelInvitation'];
    case 'ACTIVE':
      return [
        'edit',
        'manageAccess',
        'sendPasswordReset',
        'lock',
        'deactivate',
        ...(user.mfaEnabled ? (['resetMfa'] as const) : []),
        'revokeSessions',
      ];
    case 'LOCKED':
      return ['unlock', 'sendPasswordReset', 'revokeSessions'];
    case 'INACTIVE':
    case 'SUSPENDED':
      return ['edit', 'activate', 'disable'];
    case 'DISABLED':
      return ['activate'];
  }
}

/** Actions that change state; navigation-only ones (edit, manageAccess) are handled by pages. */
export type StateAction = Exclude<UserAction, 'edit' | 'manageAccess'>;

interface Subject {
  id: string;
  fullName: string;
}

/**
 * Runs a user state action with the right confirmation: sensitive actions ask
 * for confirmation (and a reason where it is recorded), then call the API.
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
          'They are signed out and cannot sign in until unlocked.',
          'Lock',
          true,
          (reason) => firstValueFrom(this.api.lock(user.id, reason)),
          `${name} is locked.`
        );
      case 'deactivate':
        return this.withReason(
          `Deactivate ${name}?`,
          'They will not be able to sign in.',
          'Deactivate',
          true,
          (reason) => firstValueFrom(this.api.setStatus(user.id, 'INACTIVE', reason)),
          `${name} is deactivated.`
        );
      case 'disable':
        return this.withReason(
          `Disable ${name}?`,
          'Disabled accounts stay blocked until an administrator activates them.',
          'Disable',
          true,
          (reason) => firstValueFrom(this.api.setStatus(user.id, 'DISABLED', reason)),
          `${name} is disabled.`
        );
      case 'cancelInvitation':
        return this.withReason(
          `Cancel the invitation for ${name}?`,
          'The invitation link stops working and the account is disabled.',
          'Cancel Invitation',
          true,
          (reason) => firstValueFrom(this.api.securityAction(user.id, 'cancel-invitation', reason)),
          'Invitation cancelled.'
        );
      case 'activate':
        return this.confirmed(
          `Activate ${name}?`,
          'They will be able to sign in again.',
          'Activate',
          false,
          () => firstValueFrom(this.api.setStatus(user.id, 'ACTIVE')),
          `${name} is active.`
        );
      case 'unlock':
        return this.confirmed(
          `Unlock ${name}?`,
          'Failed sign-in attempts are cleared.',
          'Unlock',
          false,
          () => firstValueFrom(this.api.unlock(user.id)),
          `${name} is unlocked.`
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
      case 'requirePasswordChange':
        return this.confirmed(
          `Require ${name} to change password?`,
          'They are signed out, cannot sign in until they set a new password, and receive a reset link.',
          'Require',
          true,
          () => firstValueFrom(this.api.securityAction(user.id, 'require-password-change')),
          'Password change required.'
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
      case 'resetMfa':
        return this.confirmed(
          `Reset MFA for ${name}?`,
          'Their authenticator and recovery codes are removed; they must enrol again.',
          'Reset MFA',
          true,
          () => firstValueFrom(this.api.securityAction(user.id, 'reset-mfa')),
          'MFA reset.'
        );
      case 'revokeSessions':
        return this.confirmed(
          `Revoke all sessions for ${name}?`,
          'They are signed out on every device.',
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
    danger: boolean,
    call: (reason: string | null) => Promise<unknown>,
    success: string
  ): Promise<boolean> {
    const values = await this.dialogs.form({
      title,
      description,
      submitText,
      variant: danger ? 'danger' : 'primary',
      fields: [{ key: 'reason', label: 'Reason', type: 'textarea', maxLength: 500 }],
      submit: (v) => call(String(v['reason'] ?? '').trim() || null),
    });
    if (!values) return false;
    this.feedback.success(success);
    return true;
  }
}
