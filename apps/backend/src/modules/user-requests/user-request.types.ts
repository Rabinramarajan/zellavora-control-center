export const REQUEST_TYPES = [
  'NEW_USER',
  'UPDATE_USER',
  'ACCESS_CHANGE',
  'ADD_ROLE',
  'REMOVE_ROLE',
  'ADD_GROUP',
  'REMOVE_GROUP',
  'TRANSFER',
  'ACTIVATE_USER',
  'DEACTIVATE_USER',
  'UNLOCK_ACCOUNT',
  'RESET_MFA',
] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_VERIFICATION',
  'PENDING_APPROVAL',
  'APPROVED',
  'PROVISIONING',
  'COMPLETED',
  'REJECTED',
  'SENT_BACK',
  'CANCELLED',
  'FAILED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const SOURCES = ['ADMIN_PORTAL', 'API', 'SYSTEM'] as const;
export const USER_TYPES = ['EMPLOYEE', 'CONTRACTOR', 'EXTERNAL'] as const;
export const EMPLOYMENT_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'INTERN',
  'CONSULTANT',
] as const;
export const ACCESS_SCOPES = ['GLOBAL', 'BRANCH', 'DEPARTMENT', 'TEAM', 'OWN'] as const;
export const NOTE_TYPES = ['GENERAL', 'APPROVAL', 'PROVISIONING', 'SYSTEM'] as const;
export const NOTE_VISIBILITIES = ['INTERNAL', 'REQUESTER'] as const;

/** Statuses in which the requester may still edit the request body. */
export const EDITABLE_STATUSES: readonly RequestStatus[] = ['DRAFT', 'SENT_BACK'];

/** Statuses from which a request can be cancelled. */
export const CANCELLABLE_STATUSES: readonly RequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_VERIFICATION',
  'PENDING_APPROVAL',
  'SENT_BACK',
];

/** Types that act on an existing account (everything except NEW_USER). */
export const needsTargetUser = (type: RequestType): boolean => type !== 'NEW_USER';

/** Role keys that make a request privileged and add a Security Approval step. */
export const PRIVILEGED_ROLE_KEYS = new Set(['owner', 'super_admin', 'superadmin', 'admin']);
export const PRIVILEGED_PERMISSION_KEYS = new Set([
  '*:*',
  'roles:manage',
  'users:manage',
  'settings:manage',
]);

export const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  PROVISIONING: 'Provisioning',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  SENT_BACK: 'Sent Back',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

export const TYPE_LABELS: Record<RequestType, string> = {
  NEW_USER: 'New User',
  UPDATE_USER: 'Update User',
  ACCESS_CHANGE: 'Access Change',
  ADD_ROLE: 'Add Role',
  REMOVE_ROLE: 'Remove Role',
  ADD_GROUP: 'Add Group',
  REMOVE_GROUP: 'Remove Group',
  TRANSFER: 'Branch / Team Transfer',
  ACTIVATE_USER: 'Activate User',
  DEACTIVATE_USER: 'Deactivate User',
  UNLOCK_ACCOUNT: 'Unlock Account',
  RESET_MFA: 'Reset MFA',
};
