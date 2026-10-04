import { PaginatedList, UserStatus } from './iam.model';

// ============================================================================
// PERMISSIONS CATALOG
// ============================================================================

export interface CatalogPermission {
  id: string;
  key: string;
  name: string;
  resource: string | null;
  action: string | null;
  description: string | null;
  groupId: string | null;
  groupName: string | null;
  roleCount: number;
  resourceActionCount: number;
  isWildcard: boolean;
  createdAt: string;
}

export interface CatalogPermissionDetail extends CatalogPermission {
  roles: Array<{ roleId: string; roleName: string; roleKey: string; effect: 'allow' | 'deny' }>;
}

export interface CatalogPermissionList extends PaginatedList<CatalogPermission> {
  resources: string[];
}

export interface PermissionGroupItem {
  id: string;
  name: string;
  description: string | null;
  permissionCount: number;
}

export interface CreateCatalogPermissionRequest {
  resource: string;
  action: string;
  description?: string | null;
  groupId?: string | null;
}

// ============================================================================
// ORGANIZATION (departments, teams)
// ============================================================================

export interface OrgMember {
  userId: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  status: UserStatus;
}

export type DepartmentStatus = 'active' | 'inactive';

export interface DepartmentItem {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: DepartmentStatus;
  parentId: string | null;
  parentName: string | null;
  memberCount: number;
  childCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDetail extends DepartmentItem {
  members: OrgMember[];
}

export interface SaveDepartmentRequest {
  name: string;
  code?: string | null;
  description?: string | null;
  parentId?: string | null;
  status?: DepartmentStatus;
}

export type BranchStatus = 'active' | 'inactive';

export interface BranchItem {
  id: string;
  /** Server-generated and immutable, e.g. BR-0001. */
  code: string | null;
  name: string;
  isHeadOffice: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  status: BranchStatus;
  userCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveBranchRequest {
  name: string;
  isHeadOffice?: boolean;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: BranchStatus;
}

export interface TeamItem {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  memberPreview: OrgMember[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamDetail extends Omit<TeamItem, 'memberPreview'> {
  members: OrgMember[];
}

export interface SaveTeamRequest {
  name: string;
  description?: string | null;
}

// ============================================================================
// SESSIONS
// ============================================================================

export type SessionStatus = 'active' | 'signed_out' | 'expired';

export interface SessionItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userAvatarUrl: string | null;
  organizationId: string;
  organizationName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  platform: string | null;
  isMobile: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  /** active = live; signed_out = ended by sign-out or revocation; expired = past expiresAt. */
  status: SessionStatus;
  isCurrent: boolean;
}

export interface SessionStats {
  activeSessions: number;
  activeUsers: number;
}

// ============================================================================
// SECURITY POLICIES
// ============================================================================

export interface PasswordPolicy {
  minLength: number;
  historyDepth: number;
  disallowEmailInPassword: boolean;
}

export interface LoginPolicy {
  lockoutThreshold: number;
  lockoutMinutes: number;
  sessionIdleMinutes: number;
  sessionLifetimeDays: number;
  maxConcurrentSessions: number;
  allowedIpRanges: string[];
}

export interface MfaPolicy {
  enforce: boolean;
}

export interface SecurityPolicies {
  password: PasswordPolicy;
  login: LoginPolicy;
  mfa: MfaPolicy;
}

export interface MfaComplianceUser {
  id: string;
  fullName: string;
  email: string;
  mfaEnabled: boolean;
  mfaMethod: string | null;
  mfaEnrolledAt: string | null;
  lastLoginAt: string | null;
}

export interface MfaCompliance extends PaginatedList<MfaComplianceUser> {
  summary: { total: number; enrolled: number; notEnrolled: number };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface ConfigurationItem {
  id: string;
  key: string;
  value: string;
  category: string | null;
  isEncrypted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertConfigurationRequest {
  key: string;
  value?: string;
  category?: string | null;
  isEncrypted: boolean;
}

// ============================================================================
// COMMUNICATIONS
// ============================================================================

export type AudienceType = 'all' | 'users' | 'group' | 'team' | 'department';

export type Audience = { type: 'all' } | { type: Exclude<AudienceType, 'all'>; ids: string[] };

export type MessageType = 'info' | 'success' | 'warning' | 'error';

export interface SendMessageRequest {
  audience: Audience;
  title: string;
  body: string;
  type: MessageType;
}

export interface SendEmailRequest {
  audience: Audience;
  subject: string;
  body: string;
}

export interface DeliverySummary {
  recipients: number;
  delivered: number;
  failed: number;
}

export interface CommunicationHistoryItem extends DeliverySummary {
  id: string;
  subject: string;
  type: MessageType | null;
  audience: { type: AudienceType; count?: number } | null;
  sentById: string | null;
  sentByName: string | null;
  sentAt: string;
}

/** Filters of the Common Configuration Search (`POST /iam/configurations/search`). */
export interface ConfigurationSearchCriteria {
  configKey: string | null;
  category: string | null;
}

export interface ConfigurationSearchSummary {
  categories: string[];
}

/** Filters of the Message / Email Communication Search (`POST /iam/communications/{messages|emails}/search`). */
export interface CommunicationSearchCriteria {
  subject: string | null;
  /** `YYYY-MM-DD` */
  sentFromDate: string | null;
  sentToDate: string | null;
}

/** Filters of the Branch Search (`POST /branches/search`). */
export interface BranchSearchCriteria {
  /** Matches name, code or city. */
  branchName: string | null;
  statusValue: 'active' | 'inactive' | null;
}
