/**
 * Zellavora Control Center - Type Definitions
 * All TypeScript models and interfaces
 *
 * Domain split:
 *   - Auth       — login, MFA, tokens, session
 *   - Tenant     — organizations (clients), client codes
 *   - RBAC       — roles, permissions, dynamic menus
 *   - Portfolio  — projects, skills, experience, education
 *   - Blog       — posts, categories
 *   - Media      — uploads
 *   - Audit      — security event records
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum BlogStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  SCHEDULED = 'scheduled',
}

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export enum MfaMethod {
  TOTP = 'totp',
  RECOVERY_CODE = 'recovery_code',
}

// ============================================================================
// TENANT
// ============================================================================

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  clientCode: string;
  logoUrl: string | null;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  enforce2fa: boolean;
  enforceSso: boolean;
  allowedDomains: string[] | null;
  maxMembers: number;
  createdAt: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  clientCode: string;
  logoUrl: string | null;
  plan?: string;
  enforce2fa?: boolean;
  role?: UserRole;
}

export interface TenantWithRole extends TenantSummary {
  role: UserRole;
}

// ============================================================================
// AUTHENTICATION — REQUESTS / RESPONSES
// ============================================================================

export interface LoginRequest {
  clientCode: string;
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginMfaRequest {
  mfaToken: string;
  code: string;
  rememberMe?: boolean;
}

export interface MfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
  mfaMethods: MfaMethod[];
}

export interface LoginSuccessResponse {
  mfaRequired: false;
  user: AuthUser;
  tenant: TenantSummary;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}

export type LoginResponse = MfaChallengeResponse | LoginSuccessResponse;

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}

export interface RegisterRequest {
  clientCode: string;
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  clientCode: string;
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SwitchTenantRequest {
  organizationId: string;
}

export interface ValidateClientResponse {
  valid: boolean;
  tenant: {
    id: string;
    name: string;
    clientCode: string;
    logoUrl: string | null;
    enforce2fa: boolean;
    allowedDomains: string[] | null;
  };
}

// ============================================================================
// AUTHENTICATED USER
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  mfaEnabled: boolean;
  mfaEnrolledAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

// ============================================================================
// RBAC
// ============================================================================

export interface Permission {
  code: string; // e.g. 'projects:read'
  resource: string;
  action: string;
  description?: string;
}

export interface Role {
  id: string;
  name: UserRole;
  description?: string;
  permissions: string[];
  isBuiltin: boolean;
}

export interface MenuNode {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  route: string | null;
  orderIndex: number;
  children: MenuNode[];
}

// ============================================================================
// ME PAYLOAD
// ============================================================================

export interface MeResponse {
  user: AuthUser;
  tenant: TenantSummary & { plan: string; enforce2fa: boolean };
  permissions: string[];
  menu: MenuNode[];
}

// ============================================================================
// MFA ENROLLMENT
// ============================================================================

export interface MfaEnrollStartResponse {
  otpauth: string;
  qrCodeDataUrl: string;
}

export interface MfaEnrollConfirmRequest {
  secret: string;
  code: string; // 6-digit TOTP
}

export interface MfaEnrollConfirmResponse {
  ok: true;
  recoveryCodes: string[];
}

export interface MfaDisableRequest {
  password: string;
}

export interface MfaRecoveryCodesResponse {
  recoveryCodes: string[];
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  };
}

export type ErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'TOKEN_REVOKED'
  | 'REFRESH_TOKEN_REUSE'
  | 'REFRESH_TOKEN_UNKNOWN'
  | 'INVALID_REFRESH_TOKEN'
  | 'NO_TOKEN'
  | 'MFA_REQUIRED_BY_ORG'
  | 'MFA_INVALID_CODE'
  | 'MFA_CHALLENGE_EXPIRED'
  | 'MFA_TOO_MANY_ATTEMPTS'
  | 'MFA_ENROLLMENT_EXPIRED'
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMITED_IP'
  | 'PASSWORD_POLICY_VIOLATION'
  | 'PASSWORD_TOO_COMMON'
  | 'INVALID_CURRENT_PASSWORD'
  | 'INVALID_CLIENT_CODE'
  | 'INVALID_RESET_TOKEN'
  | 'TENANT_MISMATCH'
  | 'TENANT_NOT_FOUND'
  | 'NOT_A_MEMBER'
  | 'FORBIDDEN_ROLE'
  | 'FORBIDDEN_PERMISSION'
  | 'EMAIL_EXISTS'
  | 'USER_NOT_FOUND'
  | 'SESSION_INVALID'
  | 'INTERNAL_SERVER_ERROR'
  | string; // server-defined extension

// ============================================================================
// PORTFOLIO
// ============================================================================

export interface Profile {
  id: string;
  title: string;
  bio?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImageUrl?: string;
  thumbnailUrl?: string;
  content?: string;
  status: ProjectStatus;
  category?: string;
  githubUrl?: string;
  liveDemoUrl?: string;
  websiteUrl?: string;
  viewCount: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface Skill {
  id: string;
  name: string;
  category?: string;
  proficiencyLevel?: string;
  iconUrl?: string;
  yearsOfExperience?: number;
  isFeatured: boolean;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  location?: string;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field?: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  price?: number;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Testimonial {
  id: string;
  clientName: string;
  clientTitle?: string;
  clientCompany?: string;
  content: string;
  avatarUrl?: string;
  rating?: number;
  featured: boolean;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// BLOG
// ============================================================================

export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  featuredImageUrl?: string;
  authorId: string;
  categoryId?: string;
  status: BlogStatus;
  viewCount: number;
  readTimeMinutes?: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  orderIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// MEDIA
// ============================================================================

export interface MediaFile {
  id: string;
  filename: string;
  originalFilename: string;
  filePath: string;
  mediaType: MediaType;
  fileSize: number;
  mimeType?: string;
  width?: number;
  height?: number;
  altText?: string;
  description?: string;
  uploadedBy: string;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// FORMS
// ============================================================================

export interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isDirty: boolean;
  isSubmitting: boolean;
}
