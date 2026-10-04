export type UserRequestType =
  | 'NEW_USER'
  | 'UPDATE_USER'
  | 'ACCESS_CHANGE'
  | 'ADD_ROLE'
  | 'REMOVE_ROLE'
  | 'ADD_GROUP'
  | 'REMOVE_GROUP'
  | 'TRANSFER'
  | 'ACTIVATE_USER'
  | 'DEACTIVATE_USER'
  | 'UNLOCK_ACCOUNT'
  | 'RESET_MFA';

export type UserRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_VERIFICATION'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PROVISIONING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'SENT_BACK'
  | 'CANCELLED'
  | 'FAILED';

export type UserRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface UserRequestPayload {
  user: {
    username: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    displayName: string | null;
    userType: string | null;
  };
  employee: {
    employeeCode: string | null;
    employmentType: string | null;
    designation: string | null;
    joiningDate: string | null;
    company: string | null;
    workLocation: string | null;
  };
  contact: {
    workEmail: string | null;
    contactNumber: string | null;
    alternateEmail: string | null;
    alternateContactNumber: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  };
  organization: {
    branchId: string | null;
    departmentId: string | null;
    teamId: string | null;
    reportingManagerId: string | null;
    assignedOfficerId: string | null;
    costCenter: string | null;
    location: string | null;
    accessScope: string | null;
  };
  access: {
    addGroupIds: string[];
    removeGroupIds: string[];
    addRoleIds: string[];
    removeRoleIds: string[];
  };
}

export interface UserRequestListItem {
  id: string;
  refNo: string;
  type: UserRequestType;
  typeLabel: string;
  status: UserRequestStatus;
  statusLabel: string;
  priority: UserRequestPriority;
  name: string | null;
  email: string | null;
  employeeCode: string | null;
  branchName: string | null;
  requestedBy: { id: string; name: string } | null;
  createdAt: string;
}

/** Filters of the User Request Search (`POST /iam/user-requests/search`). */
export interface UserRequestSearchCriteria {
  requestRefNo: string | null;
  requestType: UserRequestType[];
  fullName: string | null;
  employeeCode: string | null;
  emailId: string | null;
  requestedBy: string | null;
  branchId: string[];
  departmentId: string[];
  teamId: string[];
  groupId: string[];
  roleId: string[];
  statusValue: UserRequestStatus[];
  /** `YYYY-MM-DD` */
  requestedFromDate: string | null;
  requestedToDate: string | null;
}

/** Per-status totals returned alongside each search page. */
export type UserRequestStatusCounts = Record<UserRequestStatus, number>;

export interface UserRequestApproval {
  id: string;
  level: number;
  stepName: string;
  approverName: string | null;
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT_BACK' | 'CANCELLED';
  assignedAt: string | null;
  actionedAt: string | null;
  actionedByName: string | null;
  comments: string | null;
}

export interface UserRequestEvent {
  id: string;
  fromStatus: string | null;
  toStatus: UserRequestStatus;
  toStatusLabel: string;
  actorName: string | null;
  comments: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface UserRequestNote {
  id: string;
  noteType: string;
  visibility: string;
  body: string;
  attachmentUrl: string | null;
  authorName: string;
  createdAt: string;
}

export interface UserRequestEmail {
  id: string;
  template: string;
  recipient: string;
  subject: string;
  bodyText: string;
  trigger: string;
  deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface UserRequestDetail {
  id: string;
  refNo: string;
  type: UserRequestType;
  typeLabel: string;
  status: UserRequestStatus;
  statusLabel: string;
  priority: UserRequestPriority;
  source: string;
  subjectName: string | null;
  subjectEmail: string | null;
  employeeCode: string | null;
  targetUser: {
    id: string;
    name: string;
    email: string;
    employeeCode: string | null;
    status: string;
  } | null;
  requestedBy: { id: string; name: string; email: string } | null;
  justification: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  attachmentUrl: string | null;
  payload: UserRequestPayload;
  /** id → display name for every branch/department/team/group/role/person referenced in the payload. */
  names: Record<string, string>;
  currentStep: { level: number; stepName: string; approverName: string | null } | null;
  submittedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  approvals: UserRequestApproval[];
  events: UserRequestEvent[];
  notes: UserRequestNote[];
  emails: UserRequestEmail[];
  missingProvisioning: string[];
  actions: {
    canEdit: boolean;
    canSubmit: boolean;
    canApprove: boolean;
    canCompleteProvisioning: boolean;
    canReject: boolean;
    canSendBack: boolean;
    canCancel: boolean;
    canRetryProvisioning: boolean;
    canRetryEmail: boolean;
  };
}

export interface SaveUserRequest {
  type?: UserRequestType;
  targetUserId: string | null;
  priority: UserRequestPriority;
  justification: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  attachmentUrl: string | null;
  payload: UserRequestPayload;
  submit?: boolean;
}

export interface AccessCompareRow {
  key: string;
  label: string;
  current: string;
  requested: string;
  changed: boolean;
}

export interface PermissionPreviewRow {
  key: string;
  resource: string;
  permission: string;
  source: string;
  scope: string;
  current: boolean;
  requested: boolean;
  changed: boolean;
}

export interface AccessPreview {
  comparison: AccessCompareRow[];
  permissions: PermissionPreviewRow[];
  privileged: boolean;
}

export interface LookupItem {
  id: string;
  name: string;
  code?: string | null;
  key?: string;
}

export interface UserRequestLookups {
  branches: LookupItem[];
  departments: LookupItem[];
  teams: LookupItem[];
  groups: LookupItem[];
  roles: LookupItem[];
}

export interface UserRequestAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  module: string;
  target: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  result: 'Success' | 'Failure';
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}
