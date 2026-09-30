import { AccountStatus } from './iam.model';

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

export interface NamedRef {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  userCode: string | null;
  accountStatus: AccountStatus;
  statusLabel: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginDatetime: string | null;
  personal: {
    username: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    displayName: string | null;
    fullName: string;
    userType: string | null;
    language: string;
    timezone: string | null;
  };
  employee: {
    employeeCode: string | null;
    employmentType: string | null;
    designation: string | null;
    joiningDate: string | null;
    company: string | null;
    workLocation: string | null;
    costCenter: string | null;
  };
  contact: {
    workEmail: string;
    mobile: string | null;
    alternateEmail: string | null;
    alternateMobile: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  };
  organization: {
    organization: NamedRef | null;
    branch: NamedRef | null;
    department: NamedRef | null;
    team: NamedRef | null;
    reportingManager: NamedRef | null;
    assignedOfficer: NamedRef | null;
    costCenter: string | null;
    location: string | null;
    accessScope: string | null;
  };
  security: {
    emailVerified: boolean;
    emailVerifiedAt: string | null;
    mfaEnabled: boolean;
    mfaMethod: string | null;
    mfaEnrolledAt: string | null;
    isAccountLocked: boolean;
    lockedOn: string | null;
    lockReason: string | null;
    failedLoginAttempts: number;
    lastFailedLogin: string | null;
    lastSuccessfulLogin: string | null;
    passwordChangedAt: string | null;
    passwordResetRequired: boolean;
    hasPassword: boolean;
  };
  counts: {
    groups: number;
    roles: number;
    effectivePermissions: number;
    activeSessions: number;
    requests: number;
  };
  pendingInvitation: { id: string; sentAt: string; expiresAt: string } | null;
  latestRequest: { id: string; refNo: string } | null;
  actions: UserAction[];
}

/** PATCH body: only the sections (and fields) being changed. */
export interface UpdateUserProfile {
  personal?: Partial<{
    username: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    displayName: string | null;
    userType: string | null;
    avatarUrl: string | null;
    language: string;
    timezone: string | null;
  }>;
  employee?: Partial<{
    employeeCode: string;
    employmentType: string;
    designation: string | null;
    joiningDate: string | null;
    company: string | null;
    workLocation: string | null;
    costCenter: string | null;
  }>;
  contact?: Partial<{
    workEmail: string;
    mobile: string | null;
    alternateEmail: string | null;
    alternateMobile: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  }>;
  organization?: Partial<{
    branchId: string | null;
    departmentId: string | null;
    teamId: string | null;
    reportingManagerId: string | null;
    assignedOfficerId: string | null;
    accessScope: string | null;
  }>;
}

export interface UserAccessGroup {
  groupId: string;
  name: string;
  type: string;
  rolesInherited: number;
  scope: string;
  assignedOn: string;
  assignedBy: string;
}

export interface UserAccessRole {
  roleId: string;
  name: string;
  key: string;
  source: string;
  sourceType: 'DIRECT' | 'GROUP';
  groupId: string | null;
  scope: string;
  assignedBy: string;
  assignedOn: string;
}

export interface UserEffectivePermission {
  key: string;
  resource: string;
  permission: string;
  source: string;
  scope: string;
}

export interface UserAccess {
  groups: UserAccessGroup[];
  roles: UserAccessRole[];
  permissions: UserEffectivePermission[];
}

export interface UserSession {
  id: string;
  device: string;
  browser: string;
  isMobile: boolean;
  ipAddress: string | null;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface UserNoteItem {
  id: string;
  noteType: string;
  visibility: string;
  body: string;
  attachmentUrl: string | null;
  authorName: string;
  createdAt: string;
}

export interface UserRequestHistoryItem {
  id: string;
  refNo: string;
  type: string;
  typeLabel: string;
  requestedBy: string | null;
  createdAt: string;
  status: string;
  statusLabel: string;
}

export interface UserStatusHistoryItem {
  id: string;
  fromStatus: string | null;
  fromLabel: string | null;
  toStatus: string;
  toLabel: string;
  reason: string | null;
  actorName: string;
  createdAt: string;
}

export interface UserEmailItem {
  id: string;
  type: string;
  recipient: string;
  subject: string;
  trigger: string;
  sentOn: string | null;
  deliveryStatus: string;
  attempts: number;
  lastError: string | null;
  requestRef: string | null;
}

export interface UserAuditItem {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  module: string;
  targetUser: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  result: 'Success' | 'Failed';
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}
