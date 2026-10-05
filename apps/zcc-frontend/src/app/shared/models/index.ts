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
  /** INDIVIDUAL accounts: personal workspace permissions only. */
  INDIVIDUAL = 'Individual',
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

// ============================================================================
// GALLERY & TECHNOLOGY
// ============================================================================

export interface ProjectGalleryItem {
  id: string;
  projectId: string;
  url: string;
  caption?: string;
  orderIndex: number;
  createdAt?: string;
}

export interface Technology {
  id: string;
  name: string;
  category?: string;
  description?: string;
  iconUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectTechnology {
  id: string;
  projectId: string;
  technologyId: string;
  createdAt?: Date | string;
}

// ============================================================================
// COMMON RESPONSE METADATA WRAPPERS (ADDED BY EXPRESS MIDDLEWARE)
// ============================================================================

export interface InfoMessage {
  id: number;
  msg: string;
  msgType: 'Information' | 'Warning' | 'Error' | string;
}

export interface MsgWrapper {
  errorMessage: string[];
  infoMessage: InfoMessage;
}

export type WrappedResponse<T> = T & {
  msg?: MsgWrapper;
};

export * from './theme-builder.model';
export * from './notification.model';
export * from './system-health.model';
export * from './cms-builder.model';
export * from './iam.model';
export * from './auth.model';
